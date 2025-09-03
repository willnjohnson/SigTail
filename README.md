<img width="2280" height="680" alt="sigtail_logo2" src="https://github.com/user-attachments/assets/ebd7fc95-9999-4a2e-93ab-e1443efb3450" />

sigtail:a0xEcXYY::Tt0epnFZP9VXMjr/+bA/ckIkWYwp36Q1+JGDHEWjDHfhVf2mwF/Igg6GCmY1H2RVqLdu7s7AGy+lN8OtDIpYDQ==

SigTail is a utility designed to generate Ed25519 cryptographic key pairs, facilitate the signing of digital messages (such as profile URLs), and export public keys in the JSON Web Key (JWK) format. Its primary purpose is to provide a mechanism for users to cryptographically assert ownership or association with online profiles by publishing a verifiable public key and a signed message.

The project consists of two main components:

1.  **SigTail Desktop Application (Python/PySide6):** A graphical user interface (GUI) tool that enables users to:
    *   Generate a new Ed25519 private/public key pair.
    *   Sign a specified URL (e.g., a social media profile URL) using their private key, producing a Base64-encoded signature.
    *   Export their public key in JWK format.
    *   Manage and copy the generated signature string in a specific `sigtail:<pastebin_id>::<signature>` format, ready for embedding into online profiles or other text fields.
    *   Manage the Pastebin ID where the public key is hosted. The Pastebin ID is your **identifier**.

2.  **SigTail Verifier Userscript (Tampermonkey/Greasemonkey):** A browser userscript designed to scan webpages for `sigtail:` strings, retrieve the corresponding public key from a specified Pastebin URL, and cryptographically verify the embedded signature against a known message (e.g., the current page's URL). If successful, the script replaces the `sigtail:` string with a visual "verified" indicator; otherwise, it displays a "verification failed" status.

## Preview

### SigTail Verification on X
![demo](https://github.com/user-attachments/assets/fb8a32d1-2711-45a3-a6bd-00500a6de790)

* Both X accounts have the signature: `sigtail:a0xEcXYY::vQ7nWP5cZyaQcuSRb2ZJtHiyoN0bVogM7SpcpPd3pIo+Fsgn1ruKzgbr1pocbPj/aR1zCnmZpOOA42gCd5J0AQ==`
* The signature is valid for `willnjohnson` but invalid for `guiled`

<br>

### SigTail Verification on Github
<img width="1043" height="523" alt="image" src="https://github.com/user-attachments/assets/35e63bf0-a6f1-43b1-9c9a-b7ecbc47120a" />

* You can even add the badge to your Github's README.md

<br>

## Installation

### Desktop Application (Python)

To set up and run the SigTail desktop application, follow these steps:

1.  **Clone the repository** (or download the source code).
2.  **Install dependencies:** Navigate to the project directory in your terminal and run:
    ```bash
    python -m pip install -r requirements.txt
    ```
3.  **Run the application:**
    ```bash
    python SigTailGUI.py
    ```

### Verifier Userscript (Tampermonkey/Greasemonkey)

The SigTail Verifier is designed to run as a browser userscript:

1.  **Install a userscript manager:** If you don't already have one, install [Tampermonkey](https://www.tampermonkey.net/) (recommended for Chrome, Edge, Safari) or [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) (for Firefox) for your web browser.
2.  **Install the userscript:**
    *   Open your Tampermonkey/Greasemonkey dashboard.
    *   Create a new script.
    *   Copy the entire content of the `sigtail_verifier.user.js` file (or paste the script code directly) into the editor.
    *   Save the script.
3.  **Ensure it's enabled:** Verify that the "SigTail Verifier" script is enabled in your userscript manager.

### Future Revision

The next revision will have a browser extension (experimental mode).

## How It Works

1.  **Key Generation:** The desktop application generates a unique Ed25519 private/public key pair. The private key is securely stored locally (unencrypted, by default, in a user-specific data directory), and the public key is saved as a JWK file.
2.  **Public Key Publication:** Users are instructed to copy their generated public JWK and upload it as a "raw" paste to a service like Pastebin. The unique identifier (path) of this paste is then configured in the SigTail application.
3.  **Message Signing:** When a user wishes to "sign" a profile URL (e.g., their X/Twitter handle), they enter it into the application. The private key is used to generate a digital signature for this URL.
4.  **Signature Embedding:** The application generates a string in the format `sigtail:<pastebin_id>::<signature>`. This string is designed to be embedded by the user into their online profile's "About Me," "Bio," or other editable text fields.
5.  **Verification (Userscript):** When a user browsing a webpage with the SigTail Verifier userscript encounters such a `sigtail:` string:
    *   The script extracts the `<pastebin_id>` and `<signature>`.
    *   It fetches the corresponding public JWK from `https://pastebin.com/raw/<pastebin_id>`.
    *   Using the fetched public key, it attempts to verify the `<signature>` against the *current webpage's URL* (or a specific URL extracted from the context, depending on the script's configuration).
    *   A successful verification replaces the `sigtail:` string with `✅ SigTail Verified: <pastebin_id>`.
    *   A failed verification results in `❌ SigTail Verification Failed: <pastebin_id>`.

## Disclaimer

This project is a demonstration of cryptographic signing and verification in a web context. While Ed25519 is a robust and widely trusted cryptographic algorithm, **this implementation is provided "as is" and has not undergone formal security audits or penetration testing by independent security experts.**

**It is crucial to understand the following:**

*   **Approval Status:** This tool is not officially approved, endorsed, or supported by any platform (e.g., X/Twitter) for profile verification. Its functionality relies on the ability to freely embed text and fetch data from external services (Pastebin).
*   **Security Vulnerabilities:** There may be undiscovered vulnerabilities, implementation flaws, or ways to bypass or trick the signature verification process. Users should exercise caution and not rely on this tool for high-stakes authentication or critical security purposes.
*   **Message Scope:** The current userscript implementation generally verifies signatures against the `window.location.href` (the URL of the current webpage). For more robust and explicit verification, the signed message (e.g., the specific profile URL) should ideally be explicitly included within the `sigtail:` string itself (`sigtail:<pastebin_id>::<signed_url>::<signature>`) and adjusted in both the signing application and the userscript for accurate verification. The current approach assumes a contextual match.
*   **Pastebin Dependency:** The verification process relies on Pastebin (or a similar public paste service) to host the raw public keys. Any changes to Pastebin's policies, availability, or raw content serving could impact the verifier's functionality.

Users are encouraged to review the code, understand its mechanics, and use it responsibly. Contributions for security improvements, bug fixes, and feature enhancements are welcome.
