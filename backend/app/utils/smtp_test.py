import smtplib
from email.mime.text import MIMEText
import ssl

SMTP_HOST="smtp.office365.com"
SMTP_PORT=587
SMTP_USERNAME="hello@zentrixel.com"
SMTP_PASSWORD="Zensmtp@02042025"

sender = SMTP_USERNAME
receiver = "patil.rohit14@gmail.com"

message = MIMEText("This is a test email from SMTP debug script.")
message["Subject"] = "SMTP Debug Test"
message["From"] = sender
message["To"] = receiver

context = ssl.create_default_context()

try:
    print("Connecting to SMTP server...")

    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    context = ssl.create_default_context()

    # Enable full debug logs
    server.set_debuglevel(1)

    # Identify with server
    server.ehlo()

    # Start TLS encryption
    print("Starting TLS...")
    server.starttls(context=context)

    server.ehlo()

    # Login
    print("Logging in...")
    server.login(SMTP_USERNAME, SMTP_PASSWORD)

    print("Sending email...")
    response = server.sendmail(sender, receiver, message.as_string())

    print("SMTP sendmail response:", response)

    server.quit()

    if response == {}:
        print("Email accepted by SMTP server.")

except Exception as e:
    print("SMTP ERROR:", e)