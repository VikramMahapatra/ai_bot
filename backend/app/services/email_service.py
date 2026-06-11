"""
Email service for sending conversation transcripts
"""

import smtplib
import logging
import socket
import re
from sqlalchemy.orm import Session
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr, make_msgid, formatdate
from datetime import datetime
from html import unescape
import dns.resolver
from email_validator import EmailNotValidError, validate_email
from typing import Iterable, Optional
from urllib.parse import quote
from app.config import settings
from app.services.organization_setting_service import (
    get_org_smtp_config,
)
from app.models.organization_settings import OrganizationSettings
from app.models.user import Organization
from app.models.organization_email_settings import OrganizationEmailSetting

logger = logging.getLogger(__name__)
SMTP_TIMEOUT_SECONDS = 20
RESERVED_TEST_DOMAINS = {
    "example.com",
    "example.org",
    "example.net",
    "test.com",
    "localhost",
    "local",
}


def _open_smtp_server(smtp_config):
    if not smtp_config["use_tls"]:
        server = smtplib.SMTP_SSL(
            smtp_config["host"], smtp_config["port"], timeout=SMTP_TIMEOUT_SECONDS
        )
        server.ehlo()
        return server

    server = smtplib.SMTP(
        smtp_config["host"], smtp_config["port"], timeout=SMTP_TIMEOUT_SECONDS
    )

    server.ehlo()
    server.starttls()
    server.ehlo()

    return server


def _decode_smtp_message(value) -> str:
    if isinstance(value, bytes):
        return value.decode(errors="ignore")
    return str(value or "")


def _validate_email_address(value: str) -> tuple[str | None, str | None]:
    try:
        normalized = validate_email(
            (value or "").strip(), check_deliverability=False
        ).normalized
        return normalized, None
    except EmailNotValidError as exc:
        return None, str(exc)


def _is_reserved_test_email(email: str) -> bool:
    """Treat known placeholder/test domains as non-deliverable recipients."""
    if not email or "@" not in email:
        return False
    domain = email.rsplit("@", 1)[-1].strip().lower()
    return domain in RESERVED_TEST_DOMAINS


def _is_reputation_or_blocklist_rejection(rcpt_message: str) -> bool:
    """Detect anti-spam policy blocks that should not hard-stop precheck."""
    text = (rcpt_message or "").lower()
    indicators = [
        "spamhaus",
        "blocked",
        "block list",
        "blacklist",
        "denylist",
        "reputation",
        "policy",
        "service unavailable",
        "client host",
        "ip blocked",
    ]
    return any(token in text for token in indicators)


def _precheck_recipient_mailbox(
    email: str, org_email_setting: OrganizationEmailSetting
) -> tuple[bool | None, str | None]:
    """Best-effort recipient mailbox check via MX + SMTP RCPT.

    Returns:
    - (True, None): mailbox accepted by destination MX
    - (False, reason): mailbox rejected (definitive)
    - (None, reason): inconclusive, caller may proceed with normal send
    """
    if not settings.CAMPAIGN_EMAIL_RCPT_CHECK:
        return None, None

    timeout = max(3, int(settings.CAMPAIGN_EMAIL_RCPT_CHECK_TIMEOUT_SECONDS or 10))
    domain = email.split("@", 1)[1]

    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=timeout)
        mx_hosts = [
            str(record.exchange).rstrip(".")
            for record in sorted(answers, key=lambda item: item.preference)
        ]
    except Exception as exc:
        return None, f"MX lookup inconclusive: {str(exc)}"

    if not mx_hosts:
        return None, "MX lookup inconclusive: no MX hosts found"

    probe_from = org_email_setting.sender_email or "noreply@example.com"
    inconclusive_errors = []

    for host in mx_hosts[:3]:
        try:
            with smtplib.SMTP(host, 25, timeout=timeout) as smtp:
                smtp.ehlo("campaign-validator.local")
                smtp.mail(probe_from)
                rcpt_code, rcpt_message = smtp.rcpt(email)
                rcpt_text = _decode_smtp_message(rcpt_message)

                if rcpt_code in (250, 251):
                    return True, None

                # 550/551/553/554 are definitive recipient rejection responses.
                if rcpt_code in (550, 551, 553, 554):
                    if _is_reputation_or_blocklist_rejection(rcpt_text):
                        inconclusive_errors.append(
                            f"{host}: RCPT precheck inconclusive due to policy/reputation block ({rcpt_text})"
                        )
                        continue
                    return (
                        False,
                        rcpt_text or f"Recipient rejected with SMTP code {rcpt_code}",
                    )

                inconclusive_errors.append(
                    f"{host}: SMTP {rcpt_code} {rcpt_text}".strip()
                )
        except (socket.timeout, OSError, smtplib.SMTPException) as exc:
            inconclusive_errors.append(f"{host}: {str(exc)}")

    reason = "; ".join(inconclusive_errors).strip()
    return None, reason or "Recipient check inconclusive"


def send_conversation_email(
    recipient_email: str,
    conversation_data: list,
    org_email_setting: OrganizationEmailSetting,
) -> bool:
    """
    Send conversation transcript via email
    """
    try:
        print("EMAIL FUNCTION TRIGGERED")
        html_content = _create_html_email(conversation_data)
        plain_content = _html_to_plain_text(html_content)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Your Conversation Transcript - Zentrixel AI"
        msg["From"] = org_email_setting.sender_email
        msg["To"] = recipient_email

        msg.attach(MIMEText(plain_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        with _open_smtp_server(get_org_smtp_config(org_email_setting)) as server:
            print("SMTP CONNECTED")
            if org_email_setting.smtp_username and org_email_setting.smtp_password:
                print("Logging into SMTP")
                server.login(
                    org_email_setting.smtp_username, org_email_setting.smtp_password
                )
            print("Sending email...")
            refused = server.send_message(msg)
            print("Send response:", refused)

        if refused:
            logger.error(f"SMTP refused recipients: {refused}")
            return False

        logger.info(f"Conversation email accepted by SMTP for {recipient_email}")
        return True

    except Exception as e:
        logger.error(
            f"Failed to send email to {recipient_email}: {str(e)}", exc_info=True
        )
        return False


def _create_html_email(conversation_data: list) -> str:
    """Create formatted HTML email content"""

    # Generate conversation HTML
    messages_html = ""
    for msg in conversation_data:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "user":
            messages_html += f"""
            <div style="margin-bottom: 20px; text-align: right;">
                <div style="display: inline-block; max-width: 70%; background: linear-gradient(135deg, #80ccd9 0%, #4db8c9 100%); 
                           color: white; padding: 12px 16px; border-radius: 16px 16px 4px 16px; text-align: left;">
                    <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px;">You</div>
                    <div style="font-size: 14px; line-height: 1.5;">{_escape_html(content)}</div>
                </div>
            </div>
            """
        else:
            messages_html += f"""
            <div style="margin-bottom: 20px; text-align: left;">
                <div style="display: inline-block; max-width: 70%; background: #ffffff; 
                           color: #1e293b; padding: 12px 16px; border-radius: 16px 16px 16px 4px; 
                           border: 1px solid #e2e8f0; text-align: left;">
                    <div style="font-size: 11px; color: #2db3a0; margin-bottom: 4px; font-weight: bold;">AI Assistant</div>
                    <div style="font-size: 14px; line-height: 1.5;">{_escape_html(content)}</div>
                </div>
            </div>
            """

    # Complete HTML template
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                       padding: 30px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">
                    Zentrixel AI
                </h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
                    Your Conversation Transcript
                </p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 20px; background-color: #fafafa;">
                <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
                    Below is the transcript of your conversation from {datetime.now().strftime('%B %d, %Y at %I:%M %p')}
                </p>
                
                {messages_html}
            </div>
            
            <!-- Footer -->
            <div style="background-color: #1e293b; padding: 20px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    This email was sent by Zentrixel AI Chatbot Platform
                </p>
                <p style="color: #64748b; font-size: 11px; margin: 8px 0 0 0;">
                    © {datetime.now().year} Zentrixel. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    return html


def _escape_html(text: str) -> str:
    """Escape HTML special characters and preserve line breaks"""
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    text = text.replace('"', "&quot;")
    text = text.replace("'", "&#39;")
    text = text.replace("\n", "<br>")
    return text


def text_to_html(text: str) -> str:
    paragraphs = [
        p.strip() for p in text.replace("\r\n", "\n").split("\n\n") if p.strip()
    ]

    return "".join(
        f"<p>{_escape_html(p).replace(chr(10), '<br>')}</p>" for p in paragraphs
    )


def _apply_campaign_placeholders(
    template: str, recipient_name: str, campaign_name: str
) -> str:
    """Apply simple merge tags for campaign templates."""
    safe_name = (recipient_name or "there").strip() or "there"
    first_name = safe_name.split()[0] if safe_name.strip() else "there"
    replacements = {
        "{{name}}": safe_name,
        "{{first_name}}": first_name,
        "{{campaign_name}}": campaign_name or "Campaign Update",
    }

    content = template or ""
    for key, value in replacements.items():
        content = content.replace(key, value)
    return content


def _looks_like_html(content: str) -> bool:
    if not content:
        return False
    return bool(re.search(r"<\s*[a-zA-Z][^>]*>", content))


def _looks_like_full_email_html(content: str) -> bool:
    lowered = (content or "").lower()
    return "<html" in lowered or "<body" in lowered


def _preserve_html_line_breaks(content: str) -> str:
    paragraphs = re.split(r"\r?\n\s*\r?\n", content.strip())

    return "".join(f"<p>{p.replace(chr(10), '<br>')}</p>" for p in paragraphs)


def _sanitize_email_html(content: str) -> str:
    """Remove obviously unsafe script payloads from campaign HTML."""
    if not content:
        return ""

    sanitized = re.sub(
        r"<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>",
        "",
        content,
        flags=re.IGNORECASE,
    )
    sanitized = re.sub(r"javascript:", "", sanitized, flags=re.IGNORECASE)
    return sanitized


def _linkify_plain_urls(content: str) -> str:
    """Convert plain http/https URLs into clickable anchors in safe HTML fragments."""
    if not content:
        return ""

    def _replace(match: re.Match[str]) -> str:
        url = (match.group(1) or "").strip()
        if not url:
            return match.group(0)

        # Trim common trailing punctuation that should not be part of URL.
        trailing = ""
        while url and url[-1] in ".,!?;:)":
            trailing = url[-1] + trailing
            url = url[:-1]

        if not url:
            return match.group(0)

        return f'<a href="{url}" target="_blank" rel="noopener noreferrer">{url}</a>{trailing}'

    return re.sub(
        r"(?<![\"'=])(https?://[^\s<]+)", _replace, content, flags=re.IGNORECASE
    )


def _html_to_plain_text(content: str) -> str:
    if not content:
        return ""

    plain = re.sub(r"<\s*br\s*/?\s*>", "\n", content, flags=re.IGNORECASE)
    plain = re.sub(r"</\s*p\s*>", "\n\n", plain, flags=re.IGNORECASE)
    plain = re.sub(r"<[^>]+>", "", plain)
    plain = unescape(plain)
    plain = re.sub(r"\n{3,}", "\n\n", plain)
    return plain.strip()


def _starts_with_greeting(content: str) -> bool:
    plain = _html_to_plain_text(content or "").strip().lower()
    if not plain:
        return False
    return bool(re.match(r"^(hi|hello|hey|dear)\b", plain))


def _render_campaign_wrapper(
    recipient_name: str,
    campaign_name: str,
    body_html: str,
    include_greeting: bool = True,
    footer_display_enabled: bool = False,
) -> str:
    safe_name = _escape_html((recipient_name or "there").strip() or "there")
    safe_campaign = _escape_html(campaign_name or "Campaign Update")

    greeting_html = (
        f'<p style="margin-top:0; color:#425b84; font-size:15px;">Hi {safe_name},</p>'
        if include_greeting
        else ""
    )

    help_section = (
        """
        <div style="margin-top:22px; padding:14px 16px; border:1px solid #d9e7ff;
                    border-radius:10px; background:#f8fbff; color:#4a628b;
                    font-size:13px;">
            Need help or have questions? Simply reply to this email.
        </div>
        """
        if footer_display_enabled
        else ""
    )

    footer_section = (
        """
        <div style="padding:15px 26px; border-top:1px solid #e4ecf8;
                    font-size:12px; color:#6b7fa5; background:#fbfdff;">
            Powered by:
            <a href="https://zentrixel.com/"
               target="_blank"
               rel="noopener noreferrer"
               style="color:#4c7ccf; text-decoration:none;">
                zentrixel.com
            </a>
        </div>
        """
        if footer_display_enabled
        else ""
    )

    return f"""
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="font-family:Segoe UI,Arial,sans-serif;">
            <div>
                <div style="padding:10px 26px 26px 26px;">
                    {greeting_html}

                    <div style="font-size:15px; line-height:1.72;">
                        {body_html}
                    </div>

                    {help_section}
                </div>

                {footer_section}
            </div>
        </body>
    </html>
    """


def _render_instant_reply_wrapper(
    recipient_name: str,
    campaign_name: str,
    body_html: str,
    include_greeting: bool = True,
) -> str:
    safe_name = _escape_html((recipient_name or "there").strip() or "there")
    safe_campaign = _escape_html(campaign_name or "Campaign Update")
    greeting_html = (
        f'<p style="margin-top:0; color:#425b84; font-size:15px;">Hi {safe_name},</p>'
        if include_greeting
        else ""
    )
    return f"""
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset=\"UTF-8\" />
                <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
            </head>
            <body style=\"margin:0; padding:22px 10px; background:#eef3fb; font-family:Segoe UI,Arial,sans-serif; color:#1e293b;\">
                <div style=\"max-width:660px; margin:0 auto; background:#ffffff; border:1px solid #dbe6f7; border-radius:14px; overflow:hidden; box-shadow:0 12px 34px rgba(32,57,96,0.08);\">
                    <div style=\"padding:26px;\">
                        {greeting_html}
                        <div style=\"font-size:15px; line-height:1.72; color:#223659;\">{body_html}</div>
                        <div style=\"margin-top:22px; padding:14px 16px; border:1px solid #d9e7ff; border-radius:10px; background:#f8fbff; color:#4a628b; font-size:13px;\">
                            Need help or have questions? Simply reply to this email.
                        </div>
                    </div>
                </div>
            </body>
        </html>
        """


def send_new_lead_notification(
    lead_email: str,
    lead_name: str,
    lead_phone: str,
    lead_company: str = None,
    admin_emails: list = None,
    org_email_setting: OrganizationEmailSetting = None,
) -> bool:
    """
    Send notification email when new lead is captured
    """

    if not admin_emails:
        logger.warning("No admin emails provided for lead notification")
        return False

    try:

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>

        <body style="margin:0;padding:0;font-family:Segoe UI;background:#f5f5f5">

        <div style="max-width:600px;margin:auto;background:white">

        <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
        padding:30px 20px;text-align:center">
        <h1 style="color:white;margin:0">🎉 New Lead Captured!</h1>
        </div>

        <div style="padding:30px 20px">

        <p>A new lead has been captured through your AI chatbot.</p>

        <p><b>Name:</b> {_escape_html(lead_name)}</p>
        <p><b>Email:</b> {_escape_html(lead_email)}</p>
        <p><b>Phone:</b> {_escape_html(lead_phone)}</p>
        """

        if lead_company:
            html_content += f"<p><b>Company:</b> {_escape_html(lead_company)}</p>"

        html_content += f"""
        <p><b>Captured At:</b> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>

        <p style="margin-top:20px">
        <a href="{_escape_html(settings.FRONTEND_DASHBOARD_LEADS_URL)}"
        style="background:#667eea;color:white;padding:12px 20px;
        text-decoration:none;border-radius:6px">
        View in Dashboard
        </a>
        </p>

        </div>

        </div>

        </body>
        </html>
        """

        plain_content = _html_to_plain_text(html_content)

        with _open_smtp_server(get_org_smtp_config(org_email_setting)) as server:

            if org_email_setting.smtp_username and org_email_setting.smtp_password:
                server.login(
                    org_email_setting.smtp_username, org_email_setting.smtp_password
                )

            for admin_email in admin_emails:

                try:

                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = f"🎉 New Lead: {lead_name}"
                    msg["From"] = (
                        formataddr(
                            (
                                org_email_setting.sender_name,
                                org_email_setting.sender_email,
                            )
                        )
                        if org_email_setting.sender_name
                        else org_email_setting.sender_email
                    )
                    msg["To"] = admin_email
                    cc_list = get_cc_emails(org_email_setting.cc_emails)

                    if cc_list:
                        msg["Cc"] = ", ".join(cc_list)

                    msg.attach(MIMEText(plain_content, "plain", "utf-8"))
                    msg.attach(MIMEText(html_content, "html", "utf-8"))

                    refused = server.send_message(msg)

                    if refused:
                        logger.error(f"SMTP refused {admin_email}: {refused}")
                    else:
                        logger.info(f"Lead notification sent to {admin_email}")

                except Exception as e:
                    logger.error(
                        f"Failed to send lead notification to {admin_email}: {str(e)}",
                        exc_info=True,
                    )

        return True

    except Exception as e:
        logger.error(f"Error in send_new_lead_notification: {str(e)}", exc_info=True)
        return False


def send_campaign_email(
    recipient_email: str,
    recipient_name: str,
    campaign_name: str,
    message_template: str,
    subject: Optional[str] = None,
    tracking_token: Optional[str] = None,
    tracking_base_url: Optional[str] = None,
    org_email_setting: OrganizationEmailSetting = None,
    open_tracking_enabled: bool = False,
    click_tracking_enabled: bool = False,
    footer_display_enabled: bool = False,
) -> tuple[bool, str | None, str | None]:
    """Send a campaign email and return success/failure with an optional error message."""

    def _append_attribution(html: str) -> str:
        if not footer_display_enabled:
            return html

        if "zentrixel.com" in (html or "").lower():
            return html

        attribution_html = (
            '<div style="margin-top:14px;padding-top:10px;border-top:1px solid #e6edf8;'
            'font-size:11px;line-height:1.5;color:#7b8faa;text-align:center;">'
            "Powered by: "
            '<a href="https://zentrixel.com/" target="_blank" rel="noopener noreferrer" '
            'style="color:#4c7ccf;text-decoration:none;">zentrixel.com</a>'
            "</div>"
        )

        if "</body>" in html.lower():
            return re.sub(
                r"</body>",
                f"{attribution_html}</body>",
                html,
                count=1,
                flags=re.IGNORECASE,
            )
        return f"{html}{attribution_html}"

    def _inject_tracking(html: str) -> str:
        if not tracking_token or not tracking_base_url:
            return _append_attribution(html)

        base = tracking_base_url.strip().rstrip("/")
        if not base:
            return _append_attribution(html)

        # Route all campaign hyperlinks through click-tracking redirect.
        def _href_rewrite(match: re.Match[str]) -> str:
            quote_char = match.group(1)
            original_url = (match.group(2) or "").strip()
            if not original_url.lower().startswith(("http://", "https://")):
                return match.group(0)
            tracked = f"{base}/api/admin/campaigns/public/email-track/click/{tracking_token}?url={quote(original_url, safe='')}"
            return f"href={quote_char}{tracked}{quote_char}"

        tracked_html = html

        if click_tracking_enabled:
            tracked_html = re.sub(
                r"href\s*=\s*([\"'])([^\"']+)\1",
                _href_rewrite,
                html,
                flags=re.IGNORECASE,
            )

        if open_tracking_enabled:
            pixel_url = f"{base}/api/admin/campaigns/public/email-track/open/{tracking_token}.gif"
            pixel_tag = (
                f'<img src="{pixel_url}" width="1" height="1" alt="" '
                'style="display:none;max-width:1px;max-height:1px;opacity:0;" />'
            )

            if "</body>" in tracked_html.lower():
                tracked_html = re.sub(
                    r"</body>",
                    f"{pixel_tag}</body>",
                    tracked_html,
                    count=1,
                    flags=re.IGNORECASE,
                )
            else:
                tracked_html = f"{tracked_html}{pixel_tag}"

        return _append_attribution(tracked_html)

    normalized_email, validation_error = _validate_email_address(recipient_email)
    if not normalized_email:
        return False, validation_error or "Missing or invalid email", None

    rcpt_ok, rcpt_error = _precheck_recipient_mailbox(
        normalized_email, org_email_setting
    )
    if rcpt_ok is False:
        return False, rcpt_error or "Recipient mailbox rejected", None
    if rcpt_ok is None and rcpt_error:
        logger.warning(
            "Campaign recipient precheck inconclusive for %s: %s",
            normalized_email,
            rcpt_error,
        )

    try:
        sender_email = (
            org_email_setting.sender_email or org_email_setting.smtp_username or ""
        ).strip()
        envelope_sender = (org_email_setting.smtp_username or sender_email).strip()
        sender_name = (org_email_setting.sender_name or "").strip()
        reply_to_email = (org_email_setting.reply_to_email or sender_email).strip()

        if not sender_email:
            return False, "EMAIL_SENDER/SMTP_USERNAME is not configured", None

        msg = MIMEMultipart("alternative")
        msg["Subject"] = (
            subject or campaign_name or "Campaign Update"
        ).strip() or "Campaign Update"
        msg["From"] = (
            formataddr((sender_name, sender_email)) if sender_name else sender_email
        )
        msg["Reply-To"] = reply_to_email
        msg["To"] = normalized_email
        msg["Message-ID"] = make_msgid(
            domain=sender_email.split("@", 1)[1] if "@" in sender_email else None
        )
        cc_list = get_cc_emails(org_email_setting.cc_emails)

        if cc_list:
            msg["Cc"] = ", ".join(cc_list)

        personalized_template = _apply_campaign_placeholders(
            message_template or "",
            recipient_name=recipient_name,
            campaign_name=campaign_name,
        )

        if _looks_like_html(personalized_template):
            html_source = _sanitize_email_html(personalized_template)
            html_source = _preserve_html_line_breaks(html_source)
            if _looks_like_full_email_html(html_source):
                final_html = html_source
            else:
                include_greeting = not _starts_with_greeting(html_source)
                final_html = _render_campaign_wrapper(
                    recipient_name=recipient_name,
                    campaign_name=campaign_name,
                    body_html=_linkify_plain_urls(html_source),
                    include_greeting=include_greeting,
                    footer_display_enabled=footer_display_enabled,
                )
        else:
            escaped_body = text_to_html(personalized_template)
            include_greeting = not _starts_with_greeting(escaped_body)
            final_html = _render_campaign_wrapper(
                recipient_name=recipient_name,
                campaign_name=campaign_name,
                body_html=_linkify_plain_urls(escaped_body),
                include_greeting=include_greeting,
                footer_display_enabled=footer_display_enabled,
            )

        final_html = _inject_tracking(final_html)

        plain_fallback = _html_to_plain_text(final_html) or (
            personalized_template or ""
        )

        text_part = MIMEText(plain_fallback, "plain", "utf-8")
        html_part = MIMEText(final_html, "html", "utf-8")
        msg.attach(text_part)
        msg.attach(html_part)

        with _open_smtp_server(get_org_smtp_config(org_email_setting)) as server:
            server.login(
                org_email_setting.smtp_username, org_email_setting.smtp_password
            )
            refused_recipients = server.send_message(
                msg,
                from_addr=envelope_sender,
                to_addrs=[normalized_email, *cc_list],
            )

        # send_message returns a dict of refused recipients.
        # For single-recipient campaign sends, any refusal means failure.
        if refused_recipients:
            errors = []

            for email, refusal in refused_recipients.items():
                if isinstance(refusal, tuple) and len(refusal) >= 2:
                    code, message = refusal[0], _decode_smtp_message(refusal[1])
                    errors.append(f"{email} ({code}): {message}")
                else:
                    errors.append(f"{email}: SMTP recipient refused")

            return (
                False,
                "; ".join(errors),
                msg.get("Message-ID"),
            )

        logger.info(
            "Campaign email accepted by SMTP for %s (from=%s, message_id=%s)",
            normalized_email,
            sender_email,
            msg.get("Message-ID"),
        )
        return True, None, msg.get("Message-ID")
    except Exception as e:
        logger.error(
            "Failed campaign email to %s: %s", normalized_email, str(e), exc_info=True
        )
        return False, str(e), None


def send_instant_reply_email(
    recipient_email: str,
    recipient_name: str,
    campaign_name: str,
    message_template: str,
    subject: Optional[str] = None,
    tracking_token: Optional[str] = None,
    tracking_base_url: Optional[str] = None,
    org_email_setting: OrganizationEmailSetting = None,
) -> tuple[bool, str | None, str | None]:
    """Send a campaign email and return success/failure with an optional error message."""

    def _append_attribution(html: str) -> str:
        if "zentrixel.com" in (html or "").lower():
            return html

        attribution_html = (
            '<div style="margin-top:14px;padding-top:10px;border-top:1px solid #e6edf8;'
            'font-size:11px;line-height:1.5;color:#7b8faa;text-align:center;">'
            "Powered by: "
            '<a href="https://zentrixel.com/" target="_blank" rel="noopener noreferrer" '
            'style="color:#4c7ccf;text-decoration:none;">zentrixel.com</a>'
            "</div>"
        )

        if "</body>" in html.lower():
            return re.sub(
                r"</body>",
                f"{attribution_html}</body>",
                html,
                count=1,
                flags=re.IGNORECASE,
            )
        return f"{html}{attribution_html}"

    def _inject_tracking(html: str) -> str:
        if not tracking_token or not tracking_base_url:
            return _append_attribution(html)

        base = tracking_base_url.strip().rstrip("/")
        if not base:
            return _append_attribution(html)

        # Route all campaign hyperlinks through click-tracking redirect.
        def _href_rewrite(match: re.Match[str]) -> str:
            quote_char = match.group(1)
            original_url = (match.group(2) or "").strip()
            if not original_url.lower().startswith(("http://", "https://")):
                return match.group(0)
            tracked = f"{base}/api/admin/campaigns/public/email-track/click/{tracking_token}?url={quote(original_url, safe='')}"
            return f"href={quote_char}{tracked}{quote_char}"

        tracked_html = re.sub(
            r"href\s*=\s*([\"'])([^\"']+)\1",
            _href_rewrite,
            html,
            flags=re.IGNORECASE,
        )

        pixel_url = (
            f"{base}/api/admin/campaigns/public/email-track/open/{tracking_token}.gif"
        )
        pixel_tag = (
            f'<img src="{pixel_url}" width="1" height="1" alt="" '
            'style="display:none;max-width:1px;max-height:1px;opacity:0;" />'
        )

        if "</body>" in tracked_html.lower():
            tracked_html = re.sub(
                r"</body>",
                f"{pixel_tag}</body>",
                tracked_html,
                count=1,
                flags=re.IGNORECASE,
            )
        else:
            tracked_html = f"{tracked_html}{pixel_tag}"

        return _append_attribution(tracked_html)

    normalized_email, validation_error = _validate_email_address(recipient_email)
    if not normalized_email:
        return False, validation_error or "Missing or invalid email", None

    rcpt_ok, rcpt_error = _precheck_recipient_mailbox(
        normalized_email, org_email_setting
    )
    if rcpt_ok is False:
        return False, rcpt_error or "Recipient mailbox rejected", None
    if rcpt_ok is None and rcpt_error:
        logger.warning(
            "Campaign recipient precheck inconclusive for %s: %s",
            normalized_email,
            rcpt_error,
        )

    try:
        sender_email = (
            org_email_setting.sender_email or org_email_setting.smtp_username or ""
        ).strip()
        envelope_sender = (org_email_setting.smtp_username or sender_email).strip()
        sender_name = (org_email_setting.sender_name or "").strip()
        reply_to_email = (org_email_setting.reply_to_email or sender_email).strip()

        if not sender_email:
            return False, "EMAIL_SENDER/SMTP_USERNAME is not configured", None

        msg = MIMEMultipart("alternative")
        msg["Subject"] = (
            subject or campaign_name or "Campaign Update"
        ).strip() or "Campaign Update"
        msg["From"] = (
            formataddr((sender_name, sender_email)) if sender_name else sender_email
        )
        msg["Reply-To"] = reply_to_email
        msg["To"] = normalized_email
        msg["Message-ID"] = make_msgid(
            domain=sender_email.split("@", 1)[1] if "@" in sender_email else None
        )

        personalized_template = _apply_campaign_placeholders(
            message_template or "",
            recipient_name=recipient_name,
            campaign_name=campaign_name,
        )

        if _looks_like_html(personalized_template):
            html_source = _sanitize_email_html(personalized_template)
            if _looks_like_full_email_html(html_source):
                final_html = html_source
            else:
                include_greeting = not _starts_with_greeting(html_source)
                final_html = _render_instant_reply_wrapper(
                    recipient_name=recipient_name,
                    campaign_name=campaign_name,
                    body_html=_linkify_plain_urls(html_source),
                    include_greeting=include_greeting,
                )
        else:
            escaped_body = _escape_html(personalized_template)
            include_greeting = not _starts_with_greeting(escaped_body)
            final_html = _render_instant_reply_wrapper(
                recipient_name=recipient_name,
                campaign_name=campaign_name,
                body_html=_linkify_plain_urls(escaped_body),
                include_greeting=include_greeting,
            )

        final_html = _inject_tracking(final_html)

        plain_fallback = _html_to_plain_text(final_html) or (
            personalized_template or ""
        )

        text_part = MIMEText(plain_fallback, "plain", "utf-8")
        html_part = MIMEText(final_html, "html", "utf-8")
        msg.attach(text_part)
        msg.attach(html_part)

        with _open_smtp_server(get_org_smtp_config(org_email_setting)) as server:
            server.login(
                org_email_setting.smtp_username, org_email_setting.smtp_password
            )
            refused_recipients = server.send_message(
                msg,
                from_addr=envelope_sender,
                to_addrs=[normalized_email],
            )

        # send_message returns a dict of refused recipients.
        # For single-recipient campaign sends, any refusal means failure.
        if refused_recipients:
            refusal = refused_recipients.get(normalized_email) or next(
                iter(refused_recipients.values())
            )
            if isinstance(refusal, tuple) and len(refusal) >= 2:
                code, message = refusal[0], _decode_smtp_message(refusal[1])
                return (
                    False,
                    f"SMTP recipient refused ({code}): {message}",
                    msg.get("Message-ID"),
                )
            return False, "SMTP recipient refused", msg.get("Message-ID")

        logger.info(
            "Campaign email accepted by SMTP for %s (from=%s, message_id=%s)",
            normalized_email,
            sender_email,
            msg.get("Message-ID"),
        )
        return True, None, msg.get("Message-ID")
    except Exception as e:
        logger.error(
            "Failed campaign email to %s: %s", normalized_email, str(e), exc_info=True
        )
        return False, str(e), None


def send_widget_test_link_email(
    recipient_email: str,
    subject: str,
    message_body: str,
    org_email_setting: OrganizationEmailSetting,
) -> tuple[bool, str | None]:
    """Send a simple Zentrixel-branded widget test-link email."""
    normalized_email, validation_error = _validate_email_address(recipient_email)
    if not normalized_email:
        return False, validation_error or "Missing or invalid email"

    if _is_reserved_test_email(normalized_email):
        return False, "Recipient email uses a placeholder/test domain"

    rcpt_ok, rcpt_error = _precheck_recipient_mailbox(
        normalized_email, org_email_setting
    )
    if rcpt_ok is False:
        return False, rcpt_error or "Recipient mailbox rejected"
    if rcpt_ok is None and rcpt_error:
        logger.warning(
            "Widget test-link precheck inconclusive for %s: %s",
            normalized_email,
            rcpt_error,
        )

    sender_name = (org_email_setting.sender_name or "").strip()
    sender_email = (
        org_email_setting.sender_email or org_email_setting.smtp_username or ""
    ).strip()
    reply_to_email = (org_email_setting.reply_to_email or sender_email).strip()
    envelope_sender = sender_email

    if not sender_email or not envelope_sender:
        return False, "EMAIL_SENDER/SMTP_USERNAME is not configured"

    safe_subject = (
        subject or "Welcome from Zentrixel"
    ).strip() or "Welcome from Zentrixel"
    safe_body = (message_body or "").strip()
    if not safe_body:
        return False, "Email content cannot be empty"

    # Keep formatting simple: preserve line breaks and auto-link URLs in HTML.
    escaped_lines = [_escape_html(line) for line in safe_body.splitlines()]
    html_body = "<br>".join(escaped_lines)
    html_body = re.sub(
        r"(https?://[^\s<]+)",
        r'<a href="\1" target="_blank" rel="noopener noreferrer">\1</a>',
        html_body,
    )

    html_content = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset=\"UTF-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
      </head>
      <body style=\"margin:0;padding:0;background:#f4f8ff;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;\">
        <div style=\"max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe7ff;\">
          <div style=\"padding:20px 24px;background:linear-gradient(135deg,#2f6bff 0%,#2d8ef0 100%);color:#ffffff;\">
            <h2 style=\"margin:0;font-size:20px;line-height:1.25;\">Welcome from Zentrixel</h2>
          </div>
          <div style=\"padding:22px 24px;font-size:14px;line-height:1.7;color:#1e293b;\">
            {html_body}
          </div>
          <div style=\"padding:14px 24px;border-top:1px solid #e5edff;font-size:12px;color:#64748b;\">
            Sent via Zentrixel AI Platform
          </div>
        </div>
      </body>
    </html>
    """
    plain_content = safe_body

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = safe_subject
        msg["From"] = (
            formataddr((sender_name, sender_email)) if sender_name else sender_email
        )
        msg["Reply-To"] = reply_to_email
        msg["To"] = normalized_email
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(
            domain=sender_email.split("@", 1)[1] if "@" in sender_email else None
        )

        cc_list = get_cc_emails(org_email_setting.cc_emails)

        if cc_list:
            msg["Cc"] = ", ".join(cc_list)

        msg.attach(MIMEText(plain_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        logger.info(
            "SMTP send debug | username=%s | sender email=%s | sender name=%s | envelope=%s",
            org_email_setting.smtp_username,
            sender_email,
            sender_name,
            envelope_sender,
        )

        with _open_smtp_server(get_org_smtp_config(org_email_setting)) as server:
            if org_email_setting.smtp_username and org_email_setting.smtp_password:
                server.login(
                    org_email_setting.smtp_username, org_email_setting.smtp_password
                )

            refused = server.send_message(
                msg,
                from_addr=envelope_sender,
                to_addrs=[normalized_email, *cc_list],
            )

        if refused:
            errors = []
            for email, refusal in refused.items():
                if isinstance(refusal, tuple) and len(refusal) >= 2:
                    code, message = refusal[0], _decode_smtp_message(refusal[1])
                    errors.append(f"{email} ({code}): {message}")
                else:
                    errors.append(f"{email}: SMTP recipient refused")

            return (False, "; ".join(errors))

        logger.info(
            "Widget test-link email accepted by SMTP for %s (message_id=%s)",
            normalized_email,
            msg.get("Message-ID"),
        )
        return True, None
    except Exception as exc:
        logger.error(
            "Failed widget test-link email to %s: %s",
            normalized_email,
            str(exc),
            exc_info=True,
        )
        return False, str(exc)


def send_smtp_test_email(
    recipient_email: str, org_name: str, org_email_setting: OrganizationEmailSetting
) -> tuple[bool, str | None]:
    """
    Send SMTP test email to verify configuration
    """
    subject = f"Test Email - {org_name} SMTP Configuration"

    message_body = f"""
    Hello,

    This is a test email to verify your SMTP configuration.

    If you're receiving this email, your SMTP settings are working correctly.

    SMTP Details:
    Host: {org_email_setting.smtp_host}
    Port: {org_email_setting.smtp_port}
    TLS Enabled: {"Yes" if org_email_setting.use_tls else "No"}

    You can now send emails from {org_name}.

    Best Regards  
    Zentrixel AI Platform
    """

    return send_widget_test_link_email(
        recipient_email=recipient_email,
        subject=subject,
        message_body=message_body,
        org_email_setting=org_email_setting,
    )


def send_appointment_rescheduled_notification(
    recipients: Iterable[str],
    participant_name: str,
    participant_email: Optional[str],
    appointment_time_label: str,
    timezone_label: str,
    previous_time_label: Optional[str] = None,
    meeting_link: Optional[str] = None,
    widget_name: Optional[str] = None,
    notes: Optional[str] = None,
    org_email_setting: OrganizationEmailSetting = None,
) -> tuple[bool, list[str]]:
    """Send appointment reschedule notifications to participant and escalation/admin contacts."""
    unique_recipients: list[str] = []
    seen: set[str] = set()

    for raw_email in recipients or []:
        normalized_email, validation_error = _validate_email_address(
            str(raw_email or "").strip()
        )
        if not normalized_email:
            if raw_email:
                logger.warning(
                    "Skipping invalid reschedule recipient %s: %s",
                    raw_email,
                    validation_error,
                )
            continue
        if _is_reserved_test_email(normalized_email):
            logger.info(
                "Skipping placeholder/test reschedule recipient: %s", normalized_email
            )
            continue
        key = normalized_email.lower()
        if key in seen:
            continue
        seen.add(key)
        unique_recipients.append(normalized_email)

    if not unique_recipients:
        return False, [
            "No valid recipients found for appointment reschedule notification"
        ]

    safe_name = _escape_html(
        (participant_name or "Participant").strip() or "Participant"
    )
    safe_participant_email = _escape_html((participant_email or "-").strip() or "-")
    safe_widget = _escape_html(
        (widget_name or "AI Assistant").strip() or "AI Assistant"
    )
    safe_time = _escape_html(appointment_time_label)
    safe_tz = _escape_html(timezone_label)
    safe_meet_link = _escape_html(
        (meeting_link or "https://meet.google.com/new").strip()
        or "https://meet.google.com/new"
    )
    safe_notes = _escape_html((notes or "").strip())
    safe_previous = _escape_html(previous_time_label) if previous_time_label else None

    html_parts = [
        "<!DOCTYPE html>",
        '<html><head><meta charset="UTF-8"></head>',
        '<body style="margin:0;padding:0;font-family:Segoe UI,Arial,sans-serif;background:#f4f7fb;color:#1f2937;">',
        '<div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;">',
        '<div style="padding:20px 24px;background:linear-gradient(130deg,#2563eb,#1d4ed8);color:#ffffff;">',
        '<h2 style="margin:0;font-size:20px;">Appointment Rescheduled</h2>',
        "</div>",
        '<div style="padding:22px 24px;font-size:14px;line-height:1.65;">',
        f'<p style="margin-top:0;">The appointment for <strong>{safe_name}</strong> has been rescheduled.</p>',
        f"<p><strong>Agent:</strong> {safe_widget}<br>",
        f"<strong>Participant Email:</strong> {safe_participant_email}<br>",
        f"<strong>New Time:</strong> {safe_time} ({safe_tz})</p>",
    ]

    if safe_previous:
        html_parts.append(f"<p><strong>Previous Time:</strong> {safe_previous}</p>")

    if safe_notes:
        html_parts.append(f"<p><strong>Notes:</strong> {safe_notes}</p>")

    html_parts.extend(
        [
            f'<p><strong>Google Meet Link:</strong><br><a href="{safe_meet_link}" target="_blank" rel="noopener noreferrer">{safe_meet_link}</a></p>',
            '<p style="color:#6b7280;font-size:12px;margin-bottom:0;">',
            "If needed, the admin can replace this link with a dedicated Google Meet URL.",
            "</p>",
            "</div>",
            "</div>",
            "</body></html>",
        ]
    )

    html_content = "".join(html_parts)
    plain_content = _html_to_plain_text(html_content)
    errors: list[str] = []
    sender_email = (
        org_email_setting.sender_email or org_email_setting.smtp_username or ""
    ).strip()
    envelope_sender = (org_email_setting.smtp_username or sender_email).strip()
    sender_name = (org_email_setting.sender_name or "").strip()
    reply_to_email = (org_email_setting.reply_to_email or sender_email).strip()

    if not sender_email or not envelope_sender:
        return False, ["EMAIL_SENDER/SMTP_USERNAME is not configured"]

    try:
        with _open_smtp_server(get_org_smtp_config(org_email_setting)) as server:
            if org_email_setting.smtp_username and org_email_setting.smtp_password:
                server.login(
                    org_email_setting.smtp_username, org_email_setting.smtp_password
                )

            for recipient in unique_recipients:
                try:
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = (
                        f"Appointment Rescheduled: {participant_name or 'Participant'}"
                    )
                    msg["From"] = (
                        formataddr((sender_name, sender_email))
                        if sender_name
                        else sender_email
                    )
                    msg["Reply-To"] = reply_to_email
                    msg["To"] = recipient
                    msg["Date"] = formatdate(localtime=True)
                    msg["Message-ID"] = make_msgid(
                        domain=(
                            sender_email.split("@", 1)[1]
                            if "@" in sender_email
                            else None
                        )
                    )
                    cc_list = get_cc_emails(org_email_setting.cc_emails)

                    if cc_list:
                        msg["Cc"] = ", ".join(cc_list)

                    msg.attach(MIMEText(plain_content, "plain", "utf-8"))
                    msg.attach(MIMEText(html_content, "html", "utf-8"))

                    refused = server.send_message(
                        msg,
                        from_addr=envelope_sender,
                        to_addrs=[recipient, *cc_list],
                    )
                    if refused:
                        errors = []
                        for email, refusal in refused.items():
                            if isinstance(refusal, tuple) and len(refusal) >= 2:
                                code, message = refusal[0], _decode_smtp_message(
                                    refusal[1]
                                )
                                errors.append(f"{email} ({code}): {message}")
                            else:
                                errors.append(f"{email}: SMTP recipient refused")
                    else:
                        logger.info(
                            "Appointment reschedule notification accepted by SMTP for %s (message_id=%s)",
                            recipient,
                            msg.get("Message-ID"),
                        )
                except Exception as recipient_exc:
                    err = f"Failed sending reschedule notification to {recipient}: {str(recipient_exc)}"
                    errors.append(err)
                    logger.error(err, exc_info=True)
    except Exception as exc:
        err = f"Reschedule notification SMTP error: {str(exc)}"
        errors.append(err)
        logger.error(err, exc_info=True)

    return len(errors) == 0, errors


def get_cc_emails(cc_emails: str | None) -> list[str]:
    if not cc_emails:
        return []

    return [email.strip() for email in cc_emails.split(",") if email.strip()]
