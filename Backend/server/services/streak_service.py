"""
Service for tracking user daily visits and calculating streaks
"""
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from ..extensions import mongo


def track_daily_visit(user_id):
    """
    Track a user's daily visit and update their streak.
    Returns updated streak information.
    """
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Get or create visit history document
        visit_doc = mongo.db.user_visits.find_one({'user_id': user_object_id})
        
        if not visit_doc:
            # First visit - create new document
            visit_doc = {
                'user_id': user_object_id,
                'last_visit_date': today,
                'visit_dates': [today],
                'current_streak': 1,
                'longest_streak': 1,
                'total_visits': 1,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            mongo.db.user_visits.insert_one(visit_doc)
        else:
            # Check if user already visited today
            last_visit = visit_doc.get('last_visit_date')
            
            # Convert to datetime if it's stored differently
            if isinstance(last_visit, datetime):
                last_visit_date = last_visit.replace(hour=0, minute=0, second=0, microsecond=0)
            else:
                last_visit_date = datetime.fromisoformat(str(last_visit)).replace(hour=0, minute=0, second=0, microsecond=0) if last_visit else None
            
            # If already visited today, don't update
            if last_visit_date and last_visit_date == today:
                return {
                    'current_streak': visit_doc.get('current_streak', 0),
                    'longest_streak': visit_doc.get('longest_streak', 0),
                    'total_visits': visit_doc.get('total_visits', 0),
                    'already_visited_today': True
                }
            
            # Calculate new streak
            current_streak = visit_doc.get('current_streak', 0)
            longest_streak = visit_doc.get('longest_streak', 0)
            visit_dates = visit_doc.get('visit_dates', [])
            
            if last_visit_date:
                # Calculate days difference
                days_diff = (today - last_visit_date).days
                
                if days_diff == 1:
                    # Consecutive day - increment streak
                    current_streak += 1
                elif days_diff > 1:
                    # Streak broken - reset to 1
                    current_streak = 1
                else:
                    # Same day (shouldn't happen due to check above, but just in case)
                    current_streak = current_streak
            else:
                # First visit ever
                current_streak = 1
            
            # Update longest streak if current is higher
            if current_streak > longest_streak:
                longest_streak = current_streak
            
            # Add today to visit dates (only if not already there)
            if today not in visit_dates:
                visit_dates.append(today)
            
            # Update document
            update_data = {
                'last_visit_date': today,
                'visit_dates': visit_dates,
                'current_streak': current_streak,
                'longest_streak': longest_streak,
                'total_visits': len(visit_dates),
                'updated_at': datetime.utcnow()
            }
            
            mongo.db.user_visits.update_one(
                {'user_id': user_object_id},
                {'$set': update_data}
            )
            
            # Also update profile with streak data
            mongo.db.profiles.update_one(
                {'user_id': user_object_id},
                {
                    '$set': {
                        'current_streak': current_streak,
                        'longest_streak': longest_streak,
                        'updated_at': datetime.utcnow()
                    }
                },
                upsert=False  # Don't create profile if it doesn't exist
            )
            
            return {
                'current_streak': current_streak,
                'longest_streak': longest_streak,
                'total_visits': len(visit_dates),
                'already_visited_today': False
            }
        
        # For new users, also update profile
        mongo.db.profiles.update_one(
            {'user_id': user_object_id},
            {
                '$set': {
                    'current_streak': 1,
                    'longest_streak': 1,
                    'updated_at': datetime.utcnow()
                }
            },
            upsert=False
        )
        
        return {
            'current_streak': 1,
            'longest_streak': 1,
            'total_visits': 1,
            'already_visited_today': False
        }
        
    except Exception as e:
        print(f"Error tracking daily visit: {e}")
        import traceback
        traceback.print_exc()
        # Return default values on error
        return {
            'current_streak': 0,
            'longest_streak': 0,
            'total_visits': 0,
            'error': str(e)
        }


def get_streak_info(user_id):
    """
    Get current streak information without updating it.
    """
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        visit_doc = mongo.db.user_visits.find_one({'user_id': user_object_id})
        
        if not visit_doc:
            return {
                'current_streak': 0,
                'longest_streak': 0,
                'total_visits': 0,
                'last_visit_date': None
            }
        
        last_visit = visit_doc.get('last_visit_date')
        
        return {
            'current_streak': visit_doc.get('current_streak', 0),
            'longest_streak': visit_doc.get('longest_streak', 0),
            'total_visits': visit_doc.get('total_visits', 0),
            'last_visit_date': last_visit.isoformat() if isinstance(last_visit, datetime) else str(last_visit) if last_visit else None
        }
        
    except Exception as e:
        print(f"Error getting streak info: {e}")
        return {
            'current_streak': 0,
            'longest_streak': 0,
            'total_visits': 0,
            'last_visit_date': None,
            'error': str(e)
        }


def get_activity_calendar(user_id, year=None, month=None):
    """
    Get activity calendar data for a user.
    Returns a list of active dates.
    If year and month are provided, returns only that month's data.
    Otherwise returns all activity dates.
    """
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        visit_doc = mongo.db.user_visits.find_one({'user_id': user_object_id})
        
        if not visit_doc:
            return {
                'active_dates': [],
                'total_active_days': 0
            }
        
        visit_dates = visit_doc.get('visit_dates', [])
        
        # Convert all visit dates to ISO format strings
        active_dates = []
        for visit_date in visit_dates:
            if isinstance(visit_date, datetime):
                # Filter by year/month if provided
                if year is not None and month is not None:
                    if visit_date.year == year and visit_date.month == month:
                        active_dates.append(visit_date.date().isoformat())
                else:
                    active_dates.append(visit_date.date().isoformat())
            elif isinstance(visit_date, str):
                try:
                    dt = datetime.fromisoformat(visit_date.replace('Z', '+00:00'))
                    if year is not None and month is not None:
                        if dt.year == year and dt.month == month:
                            active_dates.append(dt.date().isoformat())
                    else:
                        active_dates.append(dt.date().isoformat())
                except:
                    pass
        
        # Remove duplicates and sort
        active_dates = sorted(list(set(active_dates)))
        
        return {
            'active_dates': active_dates,
            'total_active_days': len(active_dates)
        }
        
    except Exception as e:
        print(f"Error getting activity calendar: {e}")
        import traceback
        traceback.print_exc()
        return {
            'active_dates': [],
            'total_active_days': 0,
            'error': str(e)
        }
