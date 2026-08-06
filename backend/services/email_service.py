import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

def load_env_file():
    """
    Helper to load environment variables from .env file in root or backend directory.
    """
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    root_dir = os.path.dirname(backend_dir)
    for env_path in [os.path.join(root_dir, ".env"), os.path.join(backend_dir, ".env")]:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, val = line.split("=", 1)
                            key = key.strip()
                            val = val.strip().strip('"').strip("'")
                            os.environ[key] = val
            except Exception as e:
                print(f"[EMAIL SERVICE] Error reading {env_path}: {e}")

def send_email_with_attachment(to_email: str, subject: str, body: str, file_path: str) -> tuple[bool, str]:
    """
    Sends an email with an attached file using SMTP settings from environment variables or .env file.
    If SMTP credentials are not configured, logs a notice and returns gracefully.
    """
    load_env_file()

    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port_str = os.getenv("SMTP_PORT", "587")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    sender_email = os.getenv("SENDER_EMAIL", smtp_username or "modernkris@gmail.com")

    try:
        smtp_port = int(smtp_port_str)
    except ValueError:
        smtp_port = 587

    # If credentials are not set in environment, log notice and return false gracefully
    if not smtp_username or not smtp_password:
        msg = f"[EMAIL SERVICE] SMTP_USERNAME or SMTP_PASSWORD not configured in .env file. Email to {to_email} skipped."
        print(msg)
        return False, "SMTP credentials (SMTP_USERNAME / SMTP_PASSWORD) not configured in .env file."

    try:
        message = MIMEMultipart()
        message["From"] = sender_email
        message["To"] = to_email
        message["Subject"] = subject

        # Attach body text
        message.attach(MIMEText(body, "plain"))

        # Attach file if path exists
        if file_path and os.path.exists(file_path):
            filename = os.path.basename(file_path)
            with open(file_path, "rb") as attachment:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(attachment.read())

            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename= {filename}",
            )
            message.attach(part)
        else:
            print(f"[EMAIL SERVICE] Warning: File attachment {file_path} not found.")

        # Connect to SMTP server and send email
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(message)
        server.quit()

        print(f"[EMAIL SERVICE] Successfully sent email to {to_email} with attachment {file_path}")
        return True, f"Successfully sent email to {to_email}"
    except Exception as e:
        err_msg = f"Failed to send email to {to_email}: {str(e)}"
        print(f"[EMAIL SERVICE] Error: {err_msg}")
        return False, err_msg
