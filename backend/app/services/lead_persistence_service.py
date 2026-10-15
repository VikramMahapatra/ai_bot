"""Lead bookkeeping staged in the submission transaction, without hidden commits."""
from datetime import datetime, timezone
from app.models import OrganizationUsage, OrganizationSubscriptionUsage, OrganizationSubscription
from app.models.lead_activities import LeadActivity
from app.services.limits_service import get_current_year_month


def stage_lead_activity(db, lead, source, session_id=None, summary=None):
    existing = (db.query(LeadActivity)
                .filter(LeadActivity.lead_id == lead.id,
                        LeadActivity.session_id == session_id,
                        LeadActivity.source == source).first())
    if existing:
        return existing
    attempt = (db.query(LeadActivity)
               .filter(LeadActivity.lead_id == lead.id, LeadActivity.source == source).count() + 1)
    activity = LeadActivity(lead_id=lead.id, session_id=session_id, source=source,
                            status="completed", attempt_label=f"{source.capitalize()} Attempt #{attempt}",
                            summary=summary)
    db.add(activity)
    db.flush()
    return activity
 

def stage_lead_usage(db, organization_id, leads_count=1):
    year, month = get_current_year_month()
    usage = (db.query(OrganizationUsage)
             .filter(OrganizationUsage.organization_id == organization_id,
                     OrganizationUsage.year == year, OrganizationUsage.month == month).first())
    if usage is None:
        usage = OrganizationUsage(organization_id=organization_id, year=year, month=month,
                                  conversations_count=0, messages_count=0, crawl_pages_count=0,
                                  documents_count=0, tokens_used=0, leads_count=0)
        db.add(usage)
    usage.leads_count = (usage.leads_count or 0) + leads_count
    # get_active_subscription commits when expiring a subscription; do not use
    # that helper inside an atomic lead submission.
    subscription = (db.query(OrganizationSubscription)
                    .filter(OrganizationSubscription.organization_id == organization_id,
                            OrganizationSubscription.is_active == True,
                            OrganizationSubscription.end_date >= datetime.now(timezone.utc)).first())
    if subscription:
        period_usage = (db.query(OrganizationSubscriptionUsage)
                        .filter(OrganizationSubscriptionUsage.organization_id == organization_id,
                                OrganizationSubscriptionUsage.period_start == subscription.start_date).first())
        if period_usage is None:
            period_usage = OrganizationSubscriptionUsage(
                organization_id=organization_id, period_start=subscription.start_date,
                period_end=subscription.end_date, conversations_count=0, messages_count=0,
                crawl_pages_count=0, documents_count=0, tokens_used=0, leads_count=0)
            db.add(period_usage)
        period_usage.leads_count = (period_usage.leads_count or 0) + leads_count
    db.flush()
    return usage