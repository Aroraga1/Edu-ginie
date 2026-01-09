"""Profile routes for user profile management"""
from flask import Blueprint, request, jsonify, session
from bson import ObjectId
from datetime import datetime
from ..extensions import mongo
from ..utils.json_utils import serialize_doc
from ..services.streak_service import track_daily_visit, get_streak_info, get_activity_calendar

profile_bp = Blueprint('profile', __name__)


@profile_bp.route('/profile/create', methods=['POST', 'OPTIONS'])
def create_profile():
    """Create or update user profile"""
    if request.method == 'OPTIONS':
        return '', 200
    
    # Check if user is logged in
    if 'user_id' not in session:
        print(f"Profile create: No user_id in session. Session keys: {list(session.keys())}")
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    data = request.get_json() or {}
    user_id = session.get('user_id')
    
    print(f"Profile create: Received data keys: {list(data.keys())}")
    print(f"Profile create: User ID from session: {user_id} (type: {type(user_id)})")
    
    try:
        # Parse user_id if it's a string
        try:
            user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
            print(f"Profile create: Parsed user_object_id: {user_object_id}")
        except Exception as oid_error:
            print(f"Profile create: Error parsing ObjectId: {oid_error}")
            return jsonify({
                'success': False,
                'message': f'Invalid user ID format: {str(oid_error)}'
            }), 400
        
        # Validate required fields
        if not data.get('bio') or not data.get('interests'):
            return jsonify({
                'success': False, 
                'message': 'Bio and interests are required'
            }), 400
        
        # Parse interests (handle both list and comma-separated string)
        interests = data.get('interests', [])
        if isinstance(interests, str):
            interests = [i.strip() for i in interests.split(',') if i.strip()]
        
        # Prepare profile data (don't include userId from request - use from session)
        profile_data = {
            'bio': data.get('bio', '').strip(),
            'interests': interests,
            'learning_goals': data.get('learningGoals', '').strip(),
            'preferred_learning_style': data.get('preferredLearningStyle', 'Visual'),
            'difficulty_level': data.get('difficultyLevel', 'Intermediate'),
            'time_commitment': data.get('timeCommitment', '1-2 hours/day'),
            'total_progress': data.get('totalProgress', 0),
            'current_streak': data.get('currentStreak', 0),
            'longest_streak': data.get('longestStreak', 0),
            'total_badges': data.get('totalBadges', 0),
            'updated_at': datetime.utcnow()
        }
        
        print(f"Profile create: Prepared profile_data keys: {list(profile_data.keys())}")
        
        # Check if profile already exists
        existing_profile = mongo.db.profiles.find_one({'user_id': user_object_id})
        
        if existing_profile:
            # Update existing profile
            mongo.db.profiles.update_one(
                {'user_id': user_object_id},
                {'$set': profile_data}
            )
            message = 'Profile updated successfully'
            # Get updated profile
            updated_profile = mongo.db.profiles.find_one({'user_id': user_object_id})
            profile_to_return = serialize_doc(updated_profile) if updated_profile else profile_data
        else:
            # Create new profile
            profile_data['user_id'] = user_object_id
            profile_data['created_at'] = datetime.utcnow()
            result = mongo.db.profiles.insert_one(profile_data)
            message = 'Profile created successfully'
            # Get created profile
            created_profile = mongo.db.profiles.find_one({'_id': result.inserted_id})
            profile_to_return = serialize_doc(created_profile) if created_profile else profile_data
        
        return jsonify({
            'success': True,
            'message': message,
            'profile': profile_to_return
        })
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error creating profile: {type(e).__name__}: {e}")
        print(f"Error traceback:\n{error_trace}")
        return jsonify({
            'success': False,
            'message': f'Failed to create profile: {str(e)}',
            'error_type': type(e).__name__
        }), 500


@profile_bp.route('/profile/get', methods=['POST', 'OPTIONS'])
def get_profile():
    """Get user profile - POST only for API calls"""
    if request.method == 'OPTIONS':
        return '', 200
    
    # Check if user is logged in
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session.get('user_id')
    
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Get profile
        profile = mongo.db.profiles.find_one({'user_id': user_object_id})
        
        if not profile:
            return jsonify({
                'success': False,
                'message': 'Profile not found'
            }), 404
        
        # Serialize profile (converts ObjectId to string)
        profile_serialized = serialize_doc(profile)
        
        return jsonify({
            'success': True,
            'profile': profile_serialized
        })
        
    except Exception as e:
        print(f"Error getting profile: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to get profile: {str(e)}'
        }), 500


@profile_bp.route('/profile/track-visit', methods=['POST', 'OPTIONS'])
def track_visit():
    """Track user's daily visit and update streak"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session.get('user_id')
    
    try:
        streak_data = track_daily_visit(user_id)
        
        return jsonify({
            'success': True,
            'streak': streak_data
        })
        
    except Exception as e:
        print(f"Error tracking visit: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Failed to track visit: {str(e)}'
        }), 500


@profile_bp.route('/profile/streak-info', methods=['GET', 'POST', 'OPTIONS'])
def get_streak_information():
    """Get streak information without updating it"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session.get('user_id')
    
    try:
        streak_info = get_streak_info(user_id)
        
        return jsonify({
            'success': True,
            'streak': streak_info
        })
        
    except Exception as e:
        print(f"Error getting streak info: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to get streak info: {str(e)}'
        }), 500


@profile_bp.route('/profile/activity-calendar', methods=['GET', 'POST', 'OPTIONS'])
def get_activity_calendar_data():
    """Get activity calendar data with all active dates"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session.get('user_id')
    data = request.get_json() or {}
    
    try:
        # Optional: filter by year and month
        year = data.get('year')
        month = data.get('month')
        
        calendar_data = get_activity_calendar(user_id, year=year, month=month)
        
        return jsonify({
            'success': True,
            'calendar': calendar_data
        })
        
    except Exception as e:
        print(f"Error getting activity calendar: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Failed to get activity calendar: {str(e)}'
        }), 500

