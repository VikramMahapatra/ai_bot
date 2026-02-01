"""
Backfill conversation metrics from existing conversations
"""
from app.database import SessionLocal
from app.models import Conversation, ConversationMetrics, Lead
from sqlalchemy import func
from datetime import datetime
from collections import defaultdict

def backfill_metrics():
    db = SessionLocal()
    
    try:
        # Get all conversation messages
        all_messages = db.query(Conversation).order_by(Conversation.session_id, Conversation.created_at).all()
        print(f"Found {len(all_messages)} messages to process")
        
        # Group messages by session_id
        sessions = defaultdict(list)
        for msg in all_messages:
            sessions[msg.session_id].append(msg)
        
        print(f"Grouped into {len(sessions)} unique sessions")
        
        metrics_created = 0
        metrics_updated = 0
        
        for session_id, messages in sessions.items():
            if not messages:
                continue
            
            # Sort messages by created_at
            messages.sort(key=lambda x: x.created_at)
            
            # Get conversation info from first message
            first_msg = messages[0]
            
            # Skip if no organization_id
            if not first_msg.organization_id:
                print(f"Skipping session {session_id} - no organization_id")
                continue
            
            # Check if metrics already exist for this session
            existing = db.query(ConversationMetrics).filter(
                ConversationMetrics.session_id == session_id
            ).first()
            
            # Calculate metrics
            total_messages = len(messages)
            user_messages = [m for m in messages if m.role == 'user']
            ai_messages = [m for m in messages if m.role == 'assistant']
            
            total_user_messages = len(user_messages)
            total_ai_messages = len(ai_messages)
            
            # Token metrics - estimate from message length
            # Rough estimate: 1 token ≈ 4 characters
            total_tokens = sum(len(m.message) // 4 + len(m.response) // 4 for m in messages)
            prompt_tokens = sum(len(m.message) // 4 for m in user_messages)
            completion_tokens = sum(len(m.response) // 4 for m in ai_messages)
            
            # Time metrics
            conversation_start = messages[0].created_at
            conversation_end = messages[-1].created_at
            duration = (conversation_end - conversation_start).total_seconds()
            
            # Average response time (time between user message and AI response)
            response_times = []
            for i in range(len(messages) - 1):
                if messages[i].role == 'user' and messages[i+1].role == 'assistant':
                    time_diff = (messages[i+1].created_at - messages[i].created_at).total_seconds()
                    response_times.append(time_diff)
            
            avg_response_time = sum(response_times) / len(response_times) if response_times else 0.0
            
            # Check for lead - use first message's conversation_id
            lead = db.query(Lead).filter(Lead.session_id == session_id).first()
            has_lead = 1 if lead else 0
            lead_name = lead.name if lead else None
            lead_email = lead.email if lead else None
            lead_company = lead.company if lead else None
            
            # Get user satisfaction from feedback (if exists)
            user_satisfaction = None
            if messages[0].feedback:
                try:
                    # Average rating from all feedback in this session
                    ratings = [f.rating for m in messages if m.feedback for f in [m.feedback] if f.rating]
                    if ratings:
                        user_satisfaction = sum(ratings) / len(ratings)
                except:
                    pass
            
            if existing:
                # Update existing metrics
                existing.total_messages = total_messages
                existing.total_user_messages = total_user_messages
                existing.total_ai_messages = total_ai_messages
                existing.total_tokens = total_tokens
                existing.prompt_tokens = prompt_tokens
                existing.completion_tokens = completion_tokens
                existing.average_response_time = avg_response_time
                existing.conversation_duration = duration
                existing.has_lead = has_lead
                existing.lead_name = lead_name
                existing.lead_email = lead_email
                existing.lead_company = lead_company
                existing.conversation_start = conversation_start
                existing.conversation_end = conversation_end
                existing.user_satisfaction = user_satisfaction
                existing.updated_at = datetime.utcnow()
                metrics_updated += 1
            else:
                # Create new metrics - use first message's id as conversation_id
                metric = ConversationMetrics(
                    conversation_id=first_msg.id,
                    session_id=session_id,
                    organization_id=first_msg.organization_id,
                    widget_id=first_msg.widget_id,
                    user_id=first_msg.user_id,
                    total_messages=total_messages,
                    total_user_messages=total_user_messages,
                    total_ai_messages=total_ai_messages,
                    total_tokens=total_tokens,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    average_response_time=avg_response_time,
                    conversation_duration=duration,
                    user_satisfaction=user_satisfaction,
                    has_lead=has_lead,
                    lead_name=lead_name,
                    lead_email=lead_email,
                    lead_company=lead_company,
                    conversation_start=conversation_start,
                    conversation_end=conversation_end,
                )
                db.add(metric)
                metrics_created += 1
            
            # Commit every 10 records
            if (metrics_created + metrics_updated) % 10 == 0:
                db.commit()
                print(f"Progress: {metrics_created + metrics_updated}/{len(sessions)}")
        
        # Final commit
        db.commit()
        
        print(f"\n✅ Backfill complete!")
        print(f"   Created: {metrics_created} metrics")
        print(f"   Updated: {metrics_updated} metrics")
        print(f"   Total: {metrics_created + metrics_updated} conversation metrics")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Starting conversation metrics backfill...")
    backfill_metrics()
