// ==UserScript==
// @name         SigTail Verifier
// @namespace    GreaseMonkey
// @version      1.1
// @description  Replaces SigTail strings with verified status badge using Ed25519 signature verification.
// @author       @willnjohnson
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SIGTAIL_REGEX = /sigtail:([a-zA-Z0-9]+)::([a-zA-Z0-9+/=]+(?:={0,2}))/g;

    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 3) {
                    processTextNode(node);
                } else if (node.nodeType === 1) {
                    node.querySelectorAll("*").forEach(child => {
                        if (child.children.length === 0 && child.textContent.match(SIGTAIL_REGEX)) {
                            processTextNode(child.firstChild);
                        }
                    });
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    document.querySelectorAll("body *").forEach(node => {
        if (node.children.length === 0 && node.textContent.match(SIGTAIL_REGEX)) {
            processTextNode(node.firstChild);
        }
    });

    function processTextNode(textNode) {
        if (!textNode || textNode.nodeType !== 3) return;

        const originalText = textNode.textContent;
        const matches = [...originalText.matchAll(SIGTAIL_REGEX)];
        if (matches.length === 0) return;

        const parent = textNode.parentNode;
        let newHTML = originalText;

        matches.forEach(match => {
            const fullMatch = match[0];
            const pasteId = match[1];
            const signatureB64 = match[2];

            // Normalize URL for verification
            const url = new URL(window.location.href);
            let normalized = url.origin + url.pathname;
            // Strip trailing slash except for root
            if (normalized.endsWith("/") && normalized !== url.origin + "/") {
                normalized = normalized.slice(0, -1);
            }
            const message = normalized;

            verifySigTail(pasteId, signatureB64, message).then(valid => {
                const badgeHTML = createBadgeHTML(valid, pasteId);
                newHTML = newHTML.replace(fullMatch, badgeHTML);
                const span = document.createElement("span");
                span.innerHTML = newHTML;
                parent.replaceChild(span, textNode);
            });
        });
    }

    function createBadgeHTML(valid, pasteId) {
        const color = valid ? "#28a745" : "#dc3545"; // green / red
        const mainText = valid ? "SigTail Verified" : "SigTail Verification Failed";
        const iconSVG = valid ? checkSVG() : crossSVG();

        return `
        <span style="
          display: inline-flex;
          align-items: center;
          padding: 3px 7px;
          margin: 0 1px;
          border-radius: 10px;
          font-style: italic;
          font-weight: bold;
          font-size: 0.85em;
          line-height: 1;
          color: white;
          background-color: ${color};
          font-family: Arial, sans-serif;
          gap: 8px;
        ">
          <svg xmlns="http://www.w3.org/2000/svg"
               viewBox="0 0 16 16"
               width="13" height="13"
               fill="white"
               style="margin-top: 2px; vertical-align: text-bottom;">
            ${iconSVG}
          </svg>
          <span>${mainText}</span>
          <span style="
              font-style: normal;
              font-weight: normal;
              font-size: 1em;
              opacity: 0.8;
              user-select: text;
          ">
            Public ID: <code style="
              background: rgba(255,255,255,0.2);
              color: white;
              padding: 0 4px;
              border-radius: 3px;
              font-family: monospace;
            ">${pasteId}</code>
          </span>
        </span>
      `;
    }

    function checkSVG() {
        return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="white">
            <path d="M13.485 1.929a1 1 0 0 1 0 1.414l-7.07 7.071a1 1 0 0 1-1.415 0L2.515 7.07a1 1 0 1 1 1.414-1.414L6 7.727l6.071-6.07a1 1 0 0 1 1.414 0z"/>
        </svg>
        `;
    }

    function crossSVG() {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
                <path d="M2 2 L14 14 M14 2 L2 14" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
            </svg>
        `;
    }

    async function verifySigTail(pasteId, signatureB64, message) {
        try {
            const res = await fetch(`https://pastebin.com/raw/${pasteId}`);
            if (!res.ok) throw new Error("Pastebin fetch failed");

            const jwk = await res.json();
            if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519") throw new Error("Invalid key type");

            const key = await importPublicKey(jwk);
            const signature = base64ToBytes(signatureB64);
            const encoder = new TextEncoder();
            const msgBuffer = encoder.encode(message);

            const verified = await window.crypto.subtle.verify(
                { name: "Ed25519" },
                key,
                signature,
                msgBuffer
            );

            return verified;
        } catch (err) {
            console.error("SigTail verify error:", err);
            return false;
        }
    }

    async function importPublicKey(jwk) {
        const rawKey = base64urlToBytes(jwk.x);
        return await crypto.subtle.importKey(
            "raw",
            rawKey,
            { name: "Ed25519", namedCurve: "Ed25519" },
            true,
            ["verify"]
        );
    }

    function base64urlToBytes(b64url) {
        b64url = b64url.replace(/-/g, '+').replace(/_/g, '/');
        while (b64url.length % 4 !== 0) b64url += '=';
        return base64ToBytes(b64url);
    }

    function base64ToBytes(b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
})();
