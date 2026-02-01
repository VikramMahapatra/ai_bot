"""
Email service for sending conversation transcripts
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from app.config import settings

logger = logging.getLogger(__name__)


def send_conversation_email(recipient_email: str, conversation_data: list) -> bool:
    """
    Send conversation transcript via email
    
    Args:
        recipient_email: Email address to send to
        conversation_data: List of message dicts with 'role' and 'content'
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Your Conversation Transcript - Zentrixel AI'
        msg['From'] = settings.EMAIL_SENDER
        msg['To'] = recipient_email
        
        # Create HTML content
        html_content = _create_html_email(conversation_data)
        
        # Attach HTML part
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        # Send email
        if settings.SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()
        
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        logger.info(f"Conversation email sent successfully to {recipient_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {str(e)}", exc_info=True)
        return False


def _create_html_email(conversation_data: list) -> str:
    """Create formatted HTML email content"""
    
    # Generate conversation HTML
    messages_html = ""
    for msg in conversation_data:
        role = msg.get('role', 'user')
        content = msg.get('content', '')
        
        if role == 'user':
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
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    text = text.replace('"', '&quot;')
    text = text.replace("'", '&#39;')
    text = text.replace('\n', '<br>')
    return text


def send_new_lead_notification(lead_email: str, lead_name: str, lead_phone: str, 
                               lead_company: str = None, admin_emails: list = None) -> bool:
    """
    Send notification email when new lead is captured
    
    Args:
        lead_email: Email of the captured lead
        lead_name: Name of the lead
        lead_phone: Phone number of the lead
        lead_company: Company of the lead (optional)
        admin_emails: List of admin emails to notify
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    
    if not admin_emails:
        logger.warning("No admin emails provided for lead notification")
        return False
    
    try:
        # Create HTML content for lead notification
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                           padding: 30px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
                        🎉 New Lead Captured!
                    </h1>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px 20px; background-color: #fafafa;">
                    <p style="color: #1e293b; font-size: 16px; margin-bottom: 20px;">
                        A new lead has been captured through your AI chatbot.
                    </p>
                    
                    <!-- Lead Details -->
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; margin-bottom: 12px;">
                            <span style="color: #64748b; font-weight: bold; font-size: 14px;">Full Name:</span>
                            <span style="color: #1e293b; font-size: 16px; font-weight: 600;">{_escape_html(lead_name)}</span>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; margin-bottom: 12px;">
                            <span style="color: #64748b; font-weight: bold; font-size: 14px;">Email:</span>
                            <span style="color: #1e293b; font-size: 16px;"><a href="mailto:{_escape_html(lead_email)}" style="color: #667eea; text-decoration: none;">{_escape_html(lead_email)}</a></span>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; margin-bottom: 12px;">
                            <span style="color: #64748b; font-weight: bold; font-size: 14px;">Phone:</span>
                            <span style="color: #1e293b; font-size: 16px;"><a href="tel:{_escape_html(lead_phone)}" style="color: #667eea; text-decoration: none;">{_escape_html(lead_phone)}</a></span>
                        </div>
                        
                        {f'''<div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; margin-bottom: 12px;">
                            <span style="color: #64748b; font-weight: bold; font-size: 14px;">Company:</span>
                            <span style="color: #1e293b; font-size: 16px;">{_escape_html(lead_company)}</span>
                        </div>''' if lead_company else ''}
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #64748b; font-weight: bold; font-size: 14px;">Captured At:</span>
                            <span style="color: #1e293b; font-size: 16px;">{datetime.now().strftime('%B %d, %Y at %I:%M %p')}</span>
                        </div>
                    </div>
                    
                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="http://localhost:5173/admin/leads" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; 
                                  font-weight: 600; font-size: 16px;">
                            View in Dashboard
                        </a>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #1e293b; padding: 20px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                        This is an automated notification from Zentrixel AI Bot
                    </p>
                    <p style="color: #64748b; font-size: 11px; margin: 8px 0 0 0;">
                        © {datetime.now().year} Zentrixel. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Send to each admin email
        for admin_email in admin_emails:
            try:
                msg = MIMEMultipart('alternative')
                msg['Subject'] = f"🎉 New Lead: {lead_name}"
                msg['From'] = settings.EMAIL_SENDER
                msg['To'] = admin_email
                
                html_part = MIMEText(html_content, 'html')
                msg.attach(html_part)
                
                # Send email
                if settings.SMTP_USE_SSL:
                    server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)
                else:
                    server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
                    server.starttls()
                
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
                server.quit()
                
                logger.info(f"Lead notification sent to {admin_email}")
            except Exception as e:
                logger.error(f"Failed to send lead notification to {admin_email}: {str(e)}", exc_info=True)
        
        return True
        
    except Exception as e:
        logger.error(f"Error in send_new_lead_notification: {str(e)}", exc_info=True)
        return False

