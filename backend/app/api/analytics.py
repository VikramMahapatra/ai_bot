"""
Analytics API endpoints for dashboard analytics and performance metrics.
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Conversation, Lead, User, KnowledgeSource, MessageFeedback, ConversationMetrics
from app.services.rag import chroma_client
from app.auth import get_current_user
from app.models.user import UserRole
from app.services.report_service import get_plan_usage_summary, get_token_usage_report
from fastapi import APIRouter, Depends, HTTPException
import re

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _percentile(values, percentile):
    if not values:
        return None
    values = sorted(values)
    k = int(round((percentile / 100) * (len(values) - 1)))
    return values[k]


def _extract_keywords(texts, limit=10):
    stopwords = {
        "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was",
        "were", "what", "when", "where", "which", "who", "how", "why", "can", "could",
        "would", "should", "a", "an", "in", "on", "of", "to", "is", "it", "as", "at",
        "by", "or", "we", "our", "us", "i", "me", "my", "they", "their", "them", "about",
    }
    counts = {}
    for text in texts:
        for word in re.findall(r"[a-zA-Z]{3,}", text.lower()):
            if word in stopwords:
                continue
            counts[word] = counts.get(word, 0) + 1
    return [
        {"keyword": k, "count": v}
        for k, v in sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    ]


def _keyword_set(texts):
    return {item["keyword"] for item in _extract_keywords(texts, limit=50)}


def _linear_forecast(series, steps=14):
    if not series:
        return []
    n = len(series)
    x_vals = list(range(n))
    y_vals = series
    x_mean = sum(x_vals) / n
    y_mean = sum(y_vals) / n
    num = sum((x_vals[i] - x_mean) * (y_vals[i] - y_mean) for i in range(n))
    den = sum((x_vals[i] - x_mean) ** 2 for i in range(n)) or 1
    slope = num / den
    intercept = y_mean - slope * x_mean
    forecasts = []
    for i in range(n, n + steps):
        value = max(0, intercept + slope * i)
        forecasts.append(round(value, 2))
    return forecasts


@router.get("/sessions-messages")
async def get_sessions_messages(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get sessions and message counts grouped by day.
    """
    try:
        org_id = current_user.organization_id
        if not org_id:
            raise HTTPException(status_code=401, detail="Organization not found")

        # Calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        # Get all conversations in range
        conversations = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "user"  # Count only user messages
        ).all()

        # Group by date
        data_dict = {}
        for conv in conversations:
            if conv.created_at:
                date_str = conv.created_at.strftime('%Y-%m-%d')
                if date_str not in data_dict:
                    data_dict[date_str] = {"sessions": set(), "messages": 0}
                data_dict[date_str]["sessions"].add(conv.session_id)
                data_dict[date_str]["messages"] += 1

        # Format response
        data = []
        for date_str in sorted(data_dict.keys()):
            data.append({
                "date": date_str,
                "sessions": len(data_dict[date_str]["sessions"]),
                "messages": data_dict[date_str]["messages"]
            })

        return {"data": data}

    except Exception as e:
        logger.error(f"Error fetching sessions/messages: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user-engagement")
async def get_user_engagement(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get user engagement by hour of day over the specified period.
    """
    try:
        org_id = current_user.organization_id
        if not org_id:
            raise HTTPException(status_code=401, detail="Organization not found")

        # Calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        # Get all conversations in range
        conversations = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "user"
        ).all()

        # Group by hour
        hour_counts = {}
        for conv in conversations:
            if conv.created_at:
                hour = conv.created_at.strftime('%H:00')
                hour_counts[hour] = hour_counts.get(hour, 0) + 1

        # Create data for all 24 hours
        data = []
        for hour in [f"{i:02d}:00" for i in range(24)]:
            data.append({
                "hour": hour,
                "users": hour_counts.get(hour, 0)
            })

        return {"data": data}

    except Exception as e:
        logger.error(f"Error fetching user engagement: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/response-time")
async def get_response_time(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get average response time (response length as proxy) by day.
    """
    try:
        org_id = current_user.organization_id
        if not org_id:
            raise HTTPException(status_code=401, detail="Organization not found")

        # Calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        # Get all conversations in range
        conversations = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "assistant"  # Get assistant responses
        ).all()

        # Group by date and calculate average response length
        data_dict = {}
        for conv in conversations:
            if conv.created_at and conv.response:
                date_str = conv.created_at.strftime('%Y-%m-%d')
                if date_str not in data_dict:
                    data_dict[date_str] = {"total_length": 0, "count": 0}
                data_dict[date_str]["total_length"] += len(conv.response)
                data_dict[date_str]["count"] += 1

        # Calculate averages and format (response time in seconds, normalized)
        data = []
        for date_str in sorted(data_dict.keys()):
            avg_length = data_dict[date_str]["total_length"] / data_dict[date_str]["count"]
            # Normalize: assume ~0.1 seconds per 100 characters
            avg_time = round(max(0.5, min(3.0, avg_length / 300)), 1)
            data.append({
                "date": date_str,
                "time": avg_time
            })

        return {"data": data}

    except Exception as e:
        logger.error(f"Error fetching response time: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def get_analytics_metrics(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get key analytics metrics: total sessions, message volume, conversion rate, avg response time.
    """
    try:
        org_id = current_user.organization_id
        if not org_id:
            raise HTTPException(status_code=401, detail="Organization not found")

        # Calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        # Get all conversations and leads
        conversations = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date
        ).all()

        leads = db.query(Lead).filter(
            Lead.organization_id == org_id,
            func.date(Lead.created_at) >= start_date,
            func.date(Lead.created_at) <= end_date
        ).all()

        # Calculate metrics
        unique_sessions = len(set(conv.session_id for conv in conversations if conv.session_id))
        total_messages = len([c for c in conversations if c.role == "user"])
        
        # Conversion rate: leads / unique sessions
        conversion_rate = 0
        if unique_sessions > 0:
            conversion_rate = round((len(leads) / unique_sessions) * 100, 1)

        # Average response time
        assistant_responses = [c for c in conversations if c.role == "assistant" and c.response]
        avg_response_time = 0.0
        if assistant_responses:
            avg_length = sum(len(c.response) for c in assistant_responses) / len(assistant_responses)
            avg_response_time = round(max(0.5, min(3.0, avg_length / 300)), 1)

        return {
            "total_sessions": unique_sessions,
            "total_messages": total_messages,
            "conversion_rate": conversion_rate,
            "avg_response_time": avg_response_time,
            "total_leads": len(leads),
            "plan_usage": get_plan_usage_summary(db, org_id)
        }

    except Exception as e:
        logger.error(f"Error fetching analytics metrics: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/message-volume")
async def get_message_volume(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get total message volume by day.
    """
    try:
        org_id = current_user.organization_id
        if not org_id:
            raise HTTPException(status_code=401, detail="Organization not found")

        # Calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        # Get all user messages (role='user') grouped by date
        conversations = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "user"
        ).all()

        # Group by date
        data_dict = {}
        for conv in conversations:
            if conv.created_at:
                date_str = conv.created_at.strftime('%Y-%m-%d')
                data_dict[date_str] = data_dict.get(date_str, 0) + 1

        # Format response
        data = []
        for date_str in sorted(data_dict.keys()):
            data.append({
                "date": date_str,
                "messages": data_dict[date_str]
            })

        return {"data": data}

    except Exception as e:
        logger.error(f"Error fetching message volume: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/advanced")
async def get_advanced_analytics(
    days: int = 30,
    sample_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get advanced analytics including funnel, retrieval quality, attribution, answer quality, cost, latency percentiles, intent keywords, unanswered questions, and forecast."""
    try:
        org_id = current_user.organization_id
        if not org_id:
            raise HTTPException(status_code=401, detail="Organization not found")

        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)
        sample_size = max(10, min(sample_size, 200))

        # Funnel aggregates (fast queries)
        total_sessions = db.query(func.count(func.distinct(Conversation.session_id))).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date
        ).scalar() or 0

        user_messages_count = db.query(func.count(Conversation.id)).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "user"
        ).scalar() or 0

        assistant_messages_count = db.query(func.count(Conversation.id)).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "assistant"
        ).scalar() or 0

        avg_messages_per_session = round(
            (user_messages_count + assistant_messages_count) / total_sessions, 2
        ) if total_sessions else 0

        avg_response_length = db.query(func.avg(func.length(Conversation.response))).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "assistant"
        ).scalar()
        avg_response_length = round(float(avg_response_length), 2) if avg_response_length else 0

        total_leads = db.query(func.count(Lead.id)).filter(
            Lead.organization_id == org_id,
            func.date(Lead.created_at) >= start_date,
            func.date(Lead.created_at) <= end_date
        ).scalar() or 0

        top_widgets = db.query(
            Conversation.widget_id,
            func.count(Conversation.id).label("message_count")
        ).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
        ).group_by(Conversation.widget_id).order_by(func.count(Conversation.id).desc()).limit(5).all()

        widget_leads = db.query(
            Lead.widget_id,
            func.count(Lead.id).label("lead_count")
        ).filter(
            Lead.organization_id == org_id,
            func.date(Lead.created_at) >= start_date,
            func.date(Lead.created_at) <= end_date,
        ).group_by(Lead.widget_id).all()

        widget_leads_map = {w.widget_id: w.lead_count for w in widget_leads}
        widget_performance = [
            {
                "widget_id": widget_id or "direct",
                "messages": int(message_count),
                "leads": int(widget_leads_map.get(widget_id, 0))
            }
            for widget_id, message_count in top_widgets
        ]

        # Lead conversion prediction per widget (Laplace smoothing)
        session_counts = db.query(
            Conversation.widget_id,
            func.count(func.distinct(Conversation.session_id)).label("sessions_count")
        ).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date
        ).group_by(Conversation.widget_id).all()

        session_map = {s.widget_id: int(s.sessions_count) for s in session_counts}
        lead_map = {w.widget_id: int(w.lead_count) for w in widget_leads}

        lead_conversion_predictions = []
        for widget_id, sessions_count in session_map.items():
            leads_count = lead_map.get(widget_id, 0)
            # Laplace smoothing to avoid zero-rate
            probability = (leads_count + 1) / (sessions_count + 2)
            lead_conversion_predictions.append({
                "widget_id": widget_id or "direct",
                "sessions": sessions_count,
                "leads": leads_count,
                "predicted_conversion_rate": round(probability * 100, 2),
            })

        lead_conversion_predictions.sort(key=lambda x: x["predicted_conversion_rate"], reverse=True)

        # Demand forecast (sessions & messages) based on daily trend
        daily_sessions = db.query(
            func.date(Conversation.created_at).label("date"),
            func.count(func.distinct(Conversation.session_id)).label("sessions")
        ).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date
        ).group_by(func.date(Conversation.created_at)).order_by(func.date(Conversation.created_at)).all()

        daily_messages = db.query(
            func.date(Conversation.created_at).label("date"),
            func.count(Conversation.id).label("messages")
        ).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date
        ).group_by(func.date(Conversation.created_at)).order_by(func.date(Conversation.created_at)).all()

        daily_leads = db.query(
            func.date(Lead.created_at).label("date"),
            func.count(Lead.id).label("leads")
        ).filter(
            Lead.organization_id == org_id,
            func.date(Lead.created_at) >= start_date,
            func.date(Lead.created_at) <= end_date
        ).group_by(func.date(Lead.created_at)).order_by(func.date(Lead.created_at)).all()

        sessions_series = [int(row.sessions) for row in daily_sessions]
        messages_series = [int(row.messages) for row in daily_messages]
        leads_series = [int(row.leads) for row in daily_leads]

        sessions_forecast = _linear_forecast(sessions_series, steps=14)
        messages_forecast = _linear_forecast(messages_series, steps=14)
        leads_forecast = _linear_forecast(leads_series, steps=14)

        demand_forecast = {
            "sessions_forecast": sessions_forecast,
            "messages_forecast": messages_forecast,
        }

        lead_forecast = {
            "leads_forecast": leads_forecast,
        }

        lead_map_by_date = {row.date: int(row.leads) for row in daily_leads}
        escalation_rate_series = []
        for row in daily_sessions:
            sessions = int(row.sessions)
            leads = int(lead_map_by_date.get(row.date, 0))
            rate = (leads / sessions * 100) if sessions else 0
            escalation_rate_series.append(round(rate, 2))
        escalation_rate_forecast = _linear_forecast(escalation_rate_series, steps=7)

        escalation_forecast = {
            "current_rate": round((total_leads / total_sessions * 100), 2) if total_sessions else 0,
            "daily_rate_forecast": escalation_rate_forecast,
        }

        # Retention (D+1, D+7, D+30)
        extended_end = end_date + timedelta(days=30)
        session_dates = db.query(
            Conversation.session_id,
            func.date(Conversation.created_at).label("date")
        ).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= extended_end
        ).all()

        def _to_date(value):
            if value is None:
                return None
            if isinstance(value, str):
                return datetime.fromisoformat(value).date()
            if hasattr(value, "date"):
                return value.date() if not isinstance(value, datetime) else value.date()
            return None

        session_date_map = {}
        for sid, dt in session_dates:
            if not sid or not dt:
                continue
            date_value = _to_date(dt)
            if not date_value:
                continue
            session_date_map.setdefault(sid, set()).add(date_value)

        first_dates = db.query(
            Conversation.session_id,
            func.min(func.date(Conversation.created_at)).label("first_date")
        ).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date
        ).group_by(Conversation.session_id).all()

        cohort_sessions = [s for s, fd in first_dates if s and fd]
        retention_counts = {"d1": 0, "d7": 0, "d30": 0}
        for sid, first_date in first_dates:
            if not sid or not first_date:
                continue
            first_date_value = _to_date(first_date)
            if not first_date_value:
                continue
            dates = session_date_map.get(sid, set())
            if (first_date_value + timedelta(days=1)) in dates:
                retention_counts["d1"] += 1
            if (first_date_value + timedelta(days=7)) in dates:
                retention_counts["d7"] += 1
            if (first_date_value + timedelta(days=30)) in dates:
                retention_counts["d30"] += 1

        cohort_size = len(cohort_sessions)
        retention = {
            "cohort_size": cohort_size,
            "d1_rate": round((retention_counts["d1"] / cohort_size) * 100, 1) if cohort_size else 0,
            "d7_rate": round((retention_counts["d7"] / cohort_size) * 100, 1) if cohort_size else 0,
            "d30_rate": round((retention_counts["d30"] / cohort_size) * 100, 1) if cohort_size else 0,
        }

        # Escalation rate (lead as escalation)
        escalation_rate = round((total_leads / total_sessions) * 100, 1) if total_sessions else 0
        escalation_by_widget = [
            {
                "widget_id": item["widget_id"],
                "messages": item["messages"],
                "leads": item["leads"],
                "escalation_rate": round((item["leads"] / max(item["messages"], 1)) * 100, 2)
            }
            for item in widget_performance
        ]

        # Topic drift (compare last 7 days vs previous 7 days)
        last7_start = end_date - timedelta(days=6)
        prev7_start = last7_start - timedelta(days=7)

        last7_messages = db.query(Conversation.message).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= last7_start,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "user"
        ).all()
        prev7_messages = db.query(Conversation.message).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= prev7_start,
            func.date(Conversation.created_at) < last7_start,
            Conversation.role == "user"
        ).all()

        last7_keywords = _keyword_set([m[0] for m in last7_messages if m and m[0]])
        prev7_keywords = _keyword_set([m[0] for m in prev7_messages if m and m[0]])
        new_topics = sorted(list(last7_keywords - prev7_keywords))[:10]
        recurring_topics = sorted(list(last7_keywords & prev7_keywords))[:10]
        topic_drift = {
            "new_topics": new_topics,
            "recurring_topics": recurring_topics,
            "new_topic_rate": round((len(new_topics) / max(len(last7_keywords), 1)) * 100, 1),
        }

        # Knowledge coverage (answered vs unanswered)
        assistant_responses = db.query(Conversation.response).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "assistant"
        ).all()
        unanswered_count = 0
        total_responses = 0
        for (resp,) in assistant_responses:
            if not resp:
                continue
            total_responses += 1
            resp_lower = resp.lower()
            if any(phrase in resp_lower for phrase in ["no relevant context found", "i don't know", "i do not know", "knowledge base doesn't contain"]):
                unanswered_count += 1
        answered_count = max(total_responses - unanswered_count, 0)
        knowledge_coverage = {
            "answered": answered_count,
            "unanswered": unanswered_count,
            "coverage_rate": round((answered_count / max(total_responses, 1)) * 100, 1),
        }

        sessions = total_sessions
        funnel = {
            "sessions": sessions,
            "sessions_with_messages": sessions,
            "leads": total_leads,
            "conversion_rate": round((total_leads / sessions * 100), 1) if sessions else 0,
        }

        # Unanswered questions
        unanswered_phrases = ["no relevant context found", "i don't know", "i do not know", "knowledge base doesn't contain"]
        # Sample conversations for heavier computations
        conversations_sample = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "user"
        ).order_by(Conversation.created_at.desc()).limit(sample_size).all()

        unanswered = []
        for conv in conversations_sample:
            if not conv.response:
                continue
            response_lower = conv.response.lower()
            if any(phrase in response_lower for phrase in unanswered_phrases):
                unanswered.append({
                    "question": conv.message,
                    "created_at": conv.created_at.isoformat() if conv.created_at else None,
                })
            if len(unanswered) >= 10:
                break

        # Retrieval quality + source attribution (sample recent messages)
        retrieval_hits = 0
        retrieval_sources_total = 0
        queries_analyzed = 0
        source_counts = {}
        sampled_conversations = conversations_sample

        for conv in sampled_conversations:
            if not conv.message or not conv.widget_id:
                continue
            try:
                results = chroma_client.query(
                    conv.message,
                    n_results=5,
                    organization_id=org_id,
                    widget_id=conv.widget_id,
                )
                docs = results.get("documents", [[]])[0] if results else []
                metadatas = results.get("metadatas", [[]])[0] if results else []
                queries_analyzed += 1

                if docs:
                    retrieval_hits += 1

                source_ids = set()
                for meta in metadatas:
                    if isinstance(meta, dict) and meta.get("source_id"):
                        source_ids.add(int(meta["source_id"]))

                retrieval_sources_total += len(source_ids)

                # Attribution: count top source_id by presence
                for source_id in source_ids:
                    source_counts[source_id] = source_counts.get(source_id, 0) + 1
            except Exception:
                continue

        source_names = {}
        if source_counts:
            sources = db.query(KnowledgeSource).filter(
                KnowledgeSource.organization_id == org_id,
                KnowledgeSource.id.in_(list(source_counts.keys()))
            ).all()
            source_names = {s.id: s.name for s in sources}

        source_attribution = [
            {
                "source_id": source_id,
                "source_name": source_names.get(source_id, f"Source {source_id}"),
                "count": count
            }
            for source_id, count in sorted(source_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]

        # Source freshness impact (based on attribution sample)
        source_age_buckets = {"0-7d": 0, "8-30d": 0, "31-90d": 0, "90d+": 0}
        if source_counts:
            sources = db.query(KnowledgeSource).filter(
                KnowledgeSource.organization_id == org_id,
                KnowledgeSource.id.in_(list(source_counts.keys()))
            ).all()
            now = datetime.utcnow().date()
            for source in sources:
                last_update = (source.updated_at or source.created_at)
                if not last_update:
                    continue
                age_days = (now - last_update.date()).days
                bucket = "90d+"
                if age_days <= 7:
                    bucket = "0-7d"
                elif age_days <= 30:
                    bucket = "8-30d"
                elif age_days <= 90:
                    bucket = "31-90d"
                source_age_buckets[bucket] += source_counts.get(source.id, 0)

        retrieval_quality = {
            "queries_analyzed": queries_analyzed,
            "hit_rate": round((retrieval_hits / queries_analyzed) * 100, 1) if queries_analyzed else 0,
            "empty_context_rate": round((1 - (retrieval_hits / queries_analyzed)) * 100, 1) if queries_analyzed else 0,
            "avg_sources_per_query": round((retrieval_sources_total / queries_analyzed), 2) if queries_analyzed else 0,
        }

        # Answer quality from feedback
        feedback = db.query(MessageFeedback).filter(
            MessageFeedback.organization_id == org_id,
            func.date(MessageFeedback.created_at) >= start_date,
            func.date(MessageFeedback.created_at) <= end_date
        ).all()
        feedback_count = len(feedback)
        avg_rating = round(sum(f.rating for f in feedback) / feedback_count, 2) if feedback_count else None
        thumbs_up = len([f for f in feedback if f.rating >= 4])
        answer_quality = {
            "feedback_count": feedback_count,
            "average_rating": avg_rating,
            "thumbs_up_rate": round((thumbs_up / feedback_count) * 100, 1) if feedback_count else 0,
        }

        # Cost analytics
        cost = get_token_usage_report(
            db,
            org_id,
            start_date=datetime.combine(start_date, datetime.min.time()),
            end_date=datetime.combine(end_date, datetime.max.time()),
        )

        # Response latency percentiles
        metrics = db.query(ConversationMetrics).filter(
            ConversationMetrics.organization_id == org_id,
            ConversationMetrics.conversation_start >= datetime.combine(start_date, datetime.min.time()),
            ConversationMetrics.conversation_start <= datetime.combine(end_date, datetime.max.time()),
        ).all()
        response_times = [m.average_response_time for m in metrics if m.average_response_time and m.average_response_time > 0]
        latency = {
            "p50": _percentile(response_times, 50),
            "p95": _percentile(response_times, 95),
        }

        # Response time forecast (daily avg)
        response_time_daily = db.query(
            func.date(ConversationMetrics.conversation_start).label("date"),
            func.avg(ConversationMetrics.average_response_time).label("avg_time")
        ).filter(
            ConversationMetrics.organization_id == org_id,
            ConversationMetrics.conversation_start >= datetime.combine(start_date, datetime.min.time()),
            ConversationMetrics.conversation_start <= datetime.combine(end_date, datetime.max.time()),
        ).group_by(func.date(ConversationMetrics.conversation_start)).order_by(func.date(ConversationMetrics.conversation_start)).all()

        response_time_series = [round(float(row.avg_time), 2) for row in response_time_daily if row.avg_time is not None]
        response_time_forecast = _linear_forecast(response_time_series, steps=7)

        # CSAT forecast (daily avg rating)
        csat_daily = db.query(
            func.date(MessageFeedback.created_at).label("date"),
            func.avg(MessageFeedback.rating).label("avg_rating")
        ).filter(
            MessageFeedback.organization_id == org_id,
            func.date(MessageFeedback.created_at) >= start_date,
            func.date(MessageFeedback.created_at) <= end_date
        ).group_by(func.date(MessageFeedback.created_at)).order_by(func.date(MessageFeedback.created_at)).all()

        csat_series = [round(float(row.avg_rating), 2) for row in csat_daily if row.avg_rating is not None]
        csat_forecast = _linear_forecast(csat_series, steps=7)

        # Intent keywords
        intent_keywords = _extract_keywords([c.message for c in conversations_sample if c.message])

        # Knowledge gap suggestions (based on unanswered questions)
        unanswered_phrases = ["no relevant context found", "i don't know", "i do not know", "knowledge base doesn't contain"]
        unanswered_convs = []
        for conv in conversations_sample:
            if not conv.message or not conv.response:
                continue
            resp_lower = conv.response.lower()
            if any(phrase in resp_lower for phrase in unanswered_phrases):
                unanswered_convs.append(conv)

        gap_keywords = _extract_keywords([c.message for c in unanswered_convs], limit=12)
        gap_suggestions = []
        for kw in gap_keywords[:6]:
            keyword = kw["keyword"]
            related = [c for c in unanswered_convs if keyword in (c.message or "").lower()]
            sample_questions = [c.message for c in related[:3]]
            widget_counts = {}
            for c in related:
                if not c.widget_id:
                    continue
                widget_counts[c.widget_id] = widget_counts.get(c.widget_id, 0) + 1
            top_widget = None
            if widget_counts:
                top_widget = max(widget_counts.items(), key=lambda x: x[1])[0]
            gap_suggestions.append({
                "keyword": keyword,
                "count": kw["count"],
                "sample_questions": sample_questions,
                "widget_id": top_widget,
                "suggested_title": f"{keyword.title()} FAQ",
            })

        # Role-based alerts (spikes in unanswered, latency, cost)
        def _severity(change_pct: float) -> str:
            if change_pct >= 50:
                return "high"
            if change_pct >= 30:
                return "medium"
            return "info"

        last7_start = end_date - timedelta(days=6)
        prev7_start = last7_start - timedelta(days=7)

        last7_convs = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= last7_start,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "user"
        ).all()
        prev7_convs = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= prev7_start,
            func.date(Conversation.created_at) < last7_start,
            Conversation.role == "user"
        ).all()

        def _unanswered_rate(convs):
            total = 0
            unanswered = 0
            for c in convs:
                if not c.response:
                    continue
                total += 1
                resp_lower = c.response.lower()
                if any(p in resp_lower for p in unanswered_phrases):
                    unanswered += 1
            return round((unanswered / total) * 100, 1) if total else 0

        last7_unanswered = _unanswered_rate(last7_convs)
        prev7_unanswered = _unanswered_rate(prev7_convs)

        last7_metrics = [m for m in metrics if m.conversation_start and m.conversation_start.date() >= last7_start]
        prev7_metrics = [m for m in metrics if m.conversation_start and prev7_start <= m.conversation_start.date() < last7_start]

        last7_latency = round(sum(m.average_response_time for m in last7_metrics if m.average_response_time) / max(len([m for m in last7_metrics if m.average_response_time]), 1), 2) if last7_metrics else 0
        prev7_latency = round(sum(m.average_response_time for m in prev7_metrics if m.average_response_time) / max(len([m for m in prev7_metrics if m.average_response_time]), 1), 2) if prev7_metrics else 0

        last7_tokens = sum(m.total_tokens or 0 for m in last7_metrics)
        prev7_tokens = sum(m.total_tokens or 0 for m in prev7_metrics)

        alerts = []

        if prev7_unanswered > 0:
            change = ((last7_unanswered - prev7_unanswered) / prev7_unanswered) * 100
            if change >= 20:
                alerts.append({
                    "type": "unanswered_spike",
                    "severity": _severity(change),
                    "title": "Unanswered spike",
                    "message": f"Unanswered rate up {round(change, 1)}% vs previous week.",
                    "current": last7_unanswered,
                    "previous": prev7_unanswered,
                })

        if prev7_latency > 0:
            change = ((last7_latency - prev7_latency) / prev7_latency) * 100
            if change >= 20:
                alerts.append({
                    "type": "latency_spike",
                    "severity": _severity(change),
                    "title": "Latency spike",
                    "message": f"Avg response time up {round(change, 1)}% vs previous week.",
                    "current": last7_latency,
                    "previous": prev7_latency,
                })

        if current_user.role == UserRole.ADMIN and prev7_tokens > 0:
            change = ((last7_tokens - prev7_tokens) / prev7_tokens) * 100
            if change >= 20:
                alerts.append({
                    "type": "cost_spike",
                    "severity": _severity(change),
                    "title": "Token cost spike",
                    "message": f"Token usage up {round(change, 1)}% vs previous week.",
                    "current": last7_tokens,
                    "previous": prev7_tokens,
                })

        # Predicted top intents (last 7 days)
        predicted_intents = _extract_keywords([m[0] for m in last7_messages if m and m[0]], limit=5)

        # Peak hour prediction (last 7 days)
        peak_hour = None
        peak_share = 0
        hour_counts = db.query(
            func.strftime('%H:00', Conversation.created_at).label("hour"),
            func.count(Conversation.id).label("count")
        ).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= last7_start,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "user"
        ).group_by(func.strftime('%H:00', Conversation.created_at)).all()

        total_hour_count = sum(int(row.count) for row in hour_counts) if hour_counts else 0
        if hour_counts:
            peak_row = max(hour_counts, key=lambda x: x.count)
            peak_hour = peak_row.hour
            peak_share = round((int(peak_row.count) / max(total_hour_count, 1)) * 100, 1)

        peak_hour_prediction = {
            "hour": peak_hour,
            "share": peak_share,
        }

        # Token forecast
        plan_usage = get_plan_usage_summary(db, org_id)
        forecast = None
        if plan_usage and plan_usage.get("limits", {}).get("monthly_token_limit"):
            token_limit = plan_usage["limits"]["monthly_token_limit"]
            tokens_used = plan_usage["used"]["tokens_used"]
            remaining = plan_usage["remaining"]["tokens_remaining"]

            # Average daily tokens (last 7 days)
            last_7_start = datetime.utcnow().date() - timedelta(days=6)
            tokens_by_date = {}
            for m in metrics:
                if not m.conversation_start:
                    continue
                if m.conversation_start.date() < last_7_start:
                    continue
                date_key = m.conversation_start.date().isoformat()
                tokens_by_date[date_key] = tokens_by_date.get(date_key, 0) + (m.total_tokens or 0)

            avg_daily_tokens = round(sum(tokens_by_date.values()) / len(tokens_by_date), 2) if tokens_by_date else 0
            days_to_exhaust = round(remaining / avg_daily_tokens, 1) if avg_daily_tokens > 0 and remaining is not None else None
            forecast_date = None
            if days_to_exhaust is not None:
                forecast_date = (datetime.utcnow() + timedelta(days=days_to_exhaust)).date().isoformat()

            forecast = {
                "token_limit": token_limit,
                "tokens_used": tokens_used,
                "tokens_remaining": remaining,
                "avg_daily_tokens": avg_daily_tokens,
                "days_to_exhaust": days_to_exhaust,
                "estimated_exhaust_date": forecast_date,
            }

        # Token forecast band (based on daily token variability)
        tokens_by_date = {}
        for m in metrics:
            if not m.conversation_start:
                continue
            date_key = m.conversation_start.date().isoformat()
            tokens_by_date[date_key] = tokens_by_date.get(date_key, 0) + (m.total_tokens or 0)
        daily_tokens = list(tokens_by_date.values())
        token_mean = round(sum(daily_tokens) / len(daily_tokens), 2) if daily_tokens else 0
        token_var = round(sum((t - token_mean) ** 2 for t in daily_tokens) / len(daily_tokens), 2) if daily_tokens else 0
        token_std = round(token_var ** 0.5, 2) if daily_tokens else 0
        token_band = {
            "mean_daily_tokens": token_mean,
            "std_daily_tokens": token_std,
            "lower": max(0, token_mean - token_std),
            "upper": token_mean + token_std,
        }

        return {
            "funnel": funnel,
            "message_stats": {
                "user_messages": user_messages_count,
                "assistant_messages": assistant_messages_count,
                "avg_messages_per_session": avg_messages_per_session,
                "avg_response_length": avg_response_length,
            },
            "widget_performance": widget_performance,
            "retrieval_quality": retrieval_quality,
            "source_attribution": source_attribution,
            "answer_quality": answer_quality,
            "cost": cost,
            "latency": latency,
            "intent_keywords": intent_keywords,
            "top_unanswered": unanswered,
            "knowledge_gaps": gap_suggestions,
            "alerts": alerts,
            "forecast": forecast,
            "ml_predictions": {
                "lead_conversion_by_widget": lead_conversion_predictions,
                "demand_forecast": demand_forecast,
                "lead_forecast": lead_forecast,
                "token_forecast_band": token_band,
                "escalation_rate_forecast": escalation_forecast,
                "response_time_forecast": response_time_forecast,
                "csat_forecast": csat_forecast,
                "predicted_intents": predicted_intents,
                "peak_hour_prediction": peak_hour_prediction,
            },
            "retention": retention,
            "escalation": {
                "overall_rate": escalation_rate,
                "by_widget": escalation_by_widget,
            },
            "topic_drift": topic_drift,
            "knowledge_coverage": knowledge_coverage,
            "source_freshness": source_age_buckets,
        }
    except Exception as e:
        logger.error(f"Error fetching advanced analytics: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/knowledge-gaps")
async def get_knowledge_gaps(
    days: int = 30,
    limit: int = 6,
    widget_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return suggested knowledge gaps based on unanswered questions."""
    try:
        org_id = current_user.organization_id
        if not org_id:
            raise HTTPException(status_code=401, detail="Organization not found")

        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        query = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "user"
        )
        if widget_id:
            query = query.filter(Conversation.widget_id == widget_id)

        conversations = query.order_by(Conversation.created_at.desc()).limit(500).all()

        unanswered_phrases = ["no relevant context found", "i don't know", "i do not know", "knowledge base doesn't contain"]
        unanswered_convs = []
        for conv in conversations:
            if not conv.message or not conv.response:
                continue
            resp_lower = conv.response.lower()
            if any(phrase in resp_lower for phrase in unanswered_phrases):
                unanswered_convs.append(conv)

        gap_keywords = _extract_keywords([c.message for c in unanswered_convs], limit=limit * 2)
        suggestions = []
        for kw in gap_keywords[:limit]:
            keyword = kw["keyword"]
            related = [c for c in unanswered_convs if keyword in (c.message or "").lower()]
            sample_questions = [c.message for c in related[:3]]
            suggestions.append({
                "keyword": keyword,
                "count": kw["count"],
                "sample_questions": sample_questions,
                "widget_id": widget_id,
                "suggested_title": f"{keyword.title()} FAQ",
            })

        return {"gaps": suggestions}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching knowledge gaps: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
