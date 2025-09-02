import sys, json, os, base64
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
from platformdirs import user_data_dir
from PySide6.QtWidgets import (
    QApplication, QWidget, QLabel, QLineEdit, QPushButton, QTextEdit, QVBoxLayout, QHBoxLayout, QMessageBox
)
from PySide6.QtGui import QClipboard

# ---------------- CONFIG ----------------
APP_NAME = "SigTail"
DATA_DIR = user_data_dir(APP_NAME, appauthor=None)

# ---------------- HELPERS ----------------
def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    return DATA_DIR

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")

def save_pem_private(private_key, path):
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    with open(path, "wb") as f:
        f.write(pem)

def load_pem_private(path):
    with open(path, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)

def save_json(obj, path):
    with open(path, "w", encoding="utf8") as f:
        json.dump(obj, f, indent=2)

def load_json(path):
    with open(path, "r", encoding="utf8") as f:
        return json.load(f)

def sign_message(private_key, message: str) -> str:
    sig = private_key.sign(message.encode("utf-8"))
    return base64.b64encode(sig).decode("ascii")

def ed25519_public_to_jwk(pubkey) -> dict:
    raw = pubkey.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw
    )
    return {
        "kty": "OKP",
        "crv": "Ed25519",
        "x": b64url(raw),
        "alg": "EdDSA",
        "use": "sig"
    }

def save_pastebin_path(path):
    with open(os.path.join(DATA_DIR, "pastebin_path.txt"), "w", encoding="utf8") as f:
        f.write(path.strip())

def load_pastebin_path():
    pb_path_file = os.path.join(DATA_DIR, "pastebin_path.txt")
    if os.path.exists(pb_path_file):
        return open(pb_path_file, "r", encoding="utf8").read().strip()
    return "<pastebin_path>"

# ---------------- GUI ----------------
class MainWindow(QWidget):
    def __init__(self):
        super().__init__()
        ensure_data_dir()
        self.priv_key_path = os.path.join(DATA_DIR, "private_key.pem")
        self.pub_jwk_path = os.path.join(DATA_DIR, "public_jwk.json")

        self.setWindowTitle(f"{APP_NAME} — Signature Tool")
        self.resize(650, 400)

        # Info
        self.info = QLabel("Generate Ed25519 keys, sign a profile URL, and export your public JWK for SigTail verification.")

        # URL input
        self.url_label = QLabel("Profile URL to sign:")
        self.url_in = QLineEdit()
        self.url_in.setPlaceholderText("https://x.com/YourHandle")

        # Pastebin path input
        self.pastebin_label = QLabel("Pastebin path (where you uploaded your public key, e.g. abc123):")
        self.pastebin_in = QLineEdit()
        self.pastebin_in.setText(load_pastebin_path())
        self.pastebin_btn = QPushButton("Save Pastebin Path")
        self.pastebin_btn.clicked.connect(self.on_save_pastebin)

        # Buttons
        self.generate_btn = QPushButton("Generate Keypair")
        self.generate_btn.clicked.connect(self.on_generate)
        self.export_btn = QPushButton("Copy Public Key")
        self.export_btn.clicked.connect(self.on_copy_pub)
        self.sign_btn = QPushButton("Sign URL")
        self.sign_btn.clicked.connect(self.on_sign)
        self.copy_btn = QPushButton("Copy Signature")
        self.copy_btn.clicked.connect(self.on_copy_sig)

        # Signature box
        self.signature_box = QTextEdit()
        self.signature_box.setReadOnly(True)

        # Status
        self.status = QLabel()

        # Layout
        self._build_layout()
        self.try_load_existing()

    def _build_layout(self):
        pb_row = QHBoxLayout()
        pb_row.addWidget(self.pastebin_in)
        pb_row.addWidget(self.pastebin_btn)

        btn_row = QHBoxLayout()
        btn_row.addWidget(self.generate_btn)
        btn_row.addWidget(self.export_btn)
        btn_row.addStretch()
        btn_row.addWidget(self.sign_btn)
        btn_row.addWidget(self.copy_btn)

        v = QVBoxLayout()
        v.addWidget(self.info)
        v.addWidget(self.url_label)
        v.addWidget(self.url_in)
        v.addWidget(self.pastebin_label)
        v.addLayout(pb_row)
        v.addLayout(btn_row)
        v.addWidget(QLabel("Signature (base64):"))
        v.addWidget(self.signature_box)
        v.addWidget(self.status)
        self.setLayout(v)

    def try_load_existing(self):
        if os.path.exists(self.priv_key_path) and os.path.exists(self.pub_jwk_path):
            self.status.setText(f"Loaded existing keys from {DATA_DIR}")
        else:
            self.status.setText("No keys found. Generate a new Ed25519 keypair.")

    def on_generate(self):
        confirm = QMessageBox.question(self, "Generate keypair",
            "This will create a new Ed25519 keypair and overwrite existing keys. Continue?")
        if confirm != QMessageBox.StandardButton.Yes:
            return

        private_key = Ed25519PrivateKey.generate()
        save_pem_private(private_key, self.priv_key_path)
        pub = private_key.public_key()
        jwk = ed25519_public_to_jwk(pub)
        save_json(jwk, self.pub_jwk_path)
        self.status.setText(f"Ed25519 keypair generated and saved to {DATA_DIR}")
        QMessageBox.information(self, "Done", "Keypair generated. Copy your public key and upload to Pastebin.")

    def on_copy_pub(self):
        if not os.path.exists(self.pub_jwk_path):
            QMessageBox.warning(self, "No public key", "No public JWK found. Generate keys first.")
            return
        pubkey_json = load_json(self.pub_jwk_path)
        cb: QClipboard = QApplication.clipboard()
        cb.setText(json.dumps(pubkey_json, indent=2))
        self.status.setText("Public key copied to clipboard. Upload raw to Pastebin (e.g. https://pastebin.com/raw/<pastebin_path>).")

    def on_save_pastebin(self):
        path = self.pastebin_in.text().strip()
        if not path:
            QMessageBox.warning(self, "No path", "Enter a Pastebin path.")
            return
        save_pastebin_path(path)
        self.status.setText(f"Pastebin path saved: {path}")

    def on_sign(self):
        url = self.url_in.text().strip()
        pastebin_id = self.get_clean_pastebin_id()
        if not url:
            QMessageBox.warning(self, "No URL", "Enter the profile URL you want to sign.")
            return
        if not os.path.exists(self.priv_key_path):
            QMessageBox.warning(self, "No private key", "No private key found. Generate keys first.")
            return
        try:
            priv = load_pem_private(self.priv_key_path)
            signature_b64 = sign_message(priv, url)
            self.signature_box.setPlainText(signature_b64)
            self.status.setText(f"Signed! Pastebin path and signature ready for: sigtail:{pastebin_id}::<signature>")
        except Exception as e:
            QMessageBox.critical(self, "Sign Error", str(e))

    def on_copy_sig(self):
        sig = self.signature_box.toPlainText().strip()
        pastebin_id = self.get_clean_pastebin_id()
        if not sig:
            return
        full_text = f"sigtail:{pastebin_id}::{sig}"
        cb: QClipboard = QApplication.clipboard()
        cb.setText(full_text)
        self.status.setText(f"Signature copied to clipboard as sigtail:{pastebin_id}::<signature>")

    def get_clean_pastebin_id(self):
        pb_input = self.pastebin_in.text().strip() or "<pastebin_path>"

        # Remove fixed Pastebin URL prefix
        if pb_input.startswith("https://pastebin.com/raw/"):
            pb_input = pb_input[len("https://pastebin.com/raw/"):]

        # Remove any trailing slash
        pb_input = pb_input.rstrip("/")

        return pb_input

# ---------------- MAIN ----------------
def main():
    app = QApplication(sys.argv)
    w = MainWindow()
    w.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
