"""Routes for fetching user data like classrooms, badges, achievements"""
import json
import math
from flask import Blueprint, request, jsonify, session
from bson import ObjectId
from datetime import datetime
from ..extensions import mongo
from ..utils.json_utils import serialize_doc
from ..services.analysis_service import (
    analyze_conversation_engagement,
    analyze_exam_performance,
    calculate_overall_confidence,
    detect_achievements,
    calculate_badges,
    save_confidence_history,
    get_confidence_trend
)
from ..services.classroom_progress_service import calculate_classroom_progress


def get_user_performance_score(user_id):
    """Calculate overall performance score for a user (0-100)"""
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Get exam performance
        exam_data = analyze_exam_performance(user_id)
        exam_score = exam_data.get('performance_score', 0)
        
        # Get conversation engagement
        conversation_data = analyze_conversation_engagement(user_id)
        engagement_score = conversation_data.get('engagement_score', 0)
        
        # Calculate overall confidence
        overall_confidence = calculate_overall_confidence(user_id, exam_data, conversation_data)
        
        # Overall performance score is weighted average:
        # - Exam performance: 40%
        # - Engagement score: 30%
        # - Overall confidence: 30%
        performance_score = round(
            (exam_score * 0.4) +
            (engagement_score * 0.3) +
            (overall_confidence * 0.3)
        )
        
        return {
            'performance_score': performance_score,
            'exam_score': exam_score,
            'engagement_score': engagement_score,
            'overall_confidence': overall_confidence,
            'total_exams': exam_data.get('total_exams', 0),
            'average_exam_score': exam_data.get('average_score', 0),
            'total_messages': conversation_data.get('total_messages', 0)
        }
    except Exception as e:
        print(f"Error calculating performance score for user {user_id}: {e}")
        return {
            'performance_score': 0,
            'exam_score': 0,
            'engagement_score': 0,
            'overall_confidence': 0,
            'total_exams': 0,
            'average_exam_score': 0,
            'total_messages': 0
        }

user_data_bp = Blueprint('user_data', __name__)


@user_data_bp.route('/api/classroom/create', methods=['POST', 'OPTIONS'])
def create_classroom():
    """Create a new classroom for the current user"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    data = request.get_json() or {}
    user_id = session.get('user_id')
    
    # Validate required fields
    if not data.get('name') or not data.get('subject'):
        return jsonify({'success': False, 'message': 'Classroom name and subject are required'}), 400
    
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Create classroom document
        classroom_data = {
            'user_id': user_object_id,
            'name': data.get('name', '').strip(),
            'subject': data.get('subject', '').strip(),
            'description': data.get('description', '').strip(),
            'preparation': data.get('preparation', '').strip(),
            'syllabus': data.get('syllabus', '').strip(),
            'topic': data.get('name', '').strip(),  # Use name as topic for now
            'media_type': data.get('mediaType', ''),
            'medium': data.get('medium', ''),
            'confidence_level': data.get('confidenceLevel', [75])[0] if isinstance(data.get('confidenceLevel'), list) else data.get('confidenceLevel', 75),
            'progress': 0,
            'members': 1,  # Creator is the first member
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        # Insert into database
        result = mongo.db.classrooms.insert_one(classroom_data)
        
        # Return created classroom
        classroom_data['id'] = str(result.inserted_id)
        classroom_data['_id'] = result.inserted_id
        
        return jsonify({
            'success': True,
            'message': 'Classroom created successfully',
            'classroom': {
                'id': str(result.inserted_id),
                'name': classroom_data['name'],
                'subject': classroom_data['subject'],
                'description': classroom_data['description'],
                'progress': 0,
                'members': 1
            }
        })
        
    except Exception as e:
        print(f"Error creating classroom: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Failed to create classroom: {str(e)}'
        }), 500


@user_data_bp.route('/api/user/classrooms', methods=['POST', 'OPTIONS'])
def get_user_classrooms():
    """Get all classrooms for the current user"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session.get('user_id')
    
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Fetch classrooms for this user
        classrooms = list(mongo.db.classrooms.find({'user_id': user_object_id}))
        
        # Format classrooms for frontend
        formatted_classrooms = []
        for classroom in classrooms:
            # Calculate actual progress based on conversations and exams
            classroom_id = str(classroom['_id'])
            progress_data = calculate_classroom_progress(user_id, classroom_id)
            progress = progress_data.get('progress', 0)
            
            # Update classroom progress in database
            mongo.db.classrooms.update_one(
                {'_id': classroom['_id']},
                {'$set': {'progress': progress, 'updated_at': datetime.utcnow()}}
            )
            
            # Count members (if you have a members collection)
            members_count = 1  # Default to 1 (just the creator)
            
            # Ensure progress is always a valid number
            progress_value = float(progress) if progress is not None else 0.0
            progress_value = max(0.0, min(100.0, progress_value))  # Clamp between 0 and 100
            
            formatted_classrooms.append({
                'id': classroom_id,
                'name': classroom.get('name', 'Unnamed Classroom'),
                'subject': classroom.get('subject', ''),
                'description': classroom.get('description', ''),
                'topic': classroom.get('topic', ''),
                'progress': progress_value,
                'members': members_count,
                'created_at': classroom.get('created_at', datetime.utcnow()).isoformat() if isinstance(classroom.get('created_at'), datetime) else None
            })
        
        return jsonify({
            'success': True,
            'classrooms': formatted_classrooms
        })
        
    except Exception as e:
        print(f"Error fetching classrooms: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Failed to fetch classrooms: {str(e)}'
        }), 500


@user_data_bp.route('/api/user/badges', methods=['POST', 'OPTIONS'])
def get_user_badges():
    """Get badges for the current user - dynamically calculated from analysis"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session.get('user_id')
    
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Get comprehensive analysis to calculate badges
        conversation_data = analyze_conversation_engagement(user_id)
        exam_data = analyze_exam_performance(user_id)
        overall_confidence = calculate_overall_confidence(user_id, exam_data, conversation_data)
        
        # Calculate badges based on current data
        earned_badges = calculate_badges(user_id, exam_data, conversation_data, overall_confidence)
        
        # Get profile for streak data
        profile = mongo.db.profiles.find_one({'user_id': user_object_id})
        current_streak = profile.get('current_streak', 0) if profile else 0
        
        # Define all available badges with dynamic descriptions
        available_badges = [
            {
                'name': 'Quick Learner',
                'icon': '⚡',
                'description': 'Completed 5+ exams',
                'key': 'quick_learner',
                'earned': 'quick_learner' in earned_badges
            },
            {
                'name': 'Consistent',
                'icon': '📅',
                'description': f'{current_streak}-day learning streak',
                'key': 'consistent',
                'earned': 'consistent' in earned_badges
            },
            {
                'name': 'Math Master',
                'icon': '🔢',
                'description': 'Achieved 90%+ in mathematics',
                'key': 'math_master',
                'earned': 'math_master' in earned_badges
            },
            {
                'name': 'AI Explorer',
                'icon': '🤖',
                'description': 'Completed AI fundamentals',
                'key': 'ai_explorer',
                'earned': 'ai_explorer' in earned_badges
            },
            {
                'name': 'Perfectionist',
                'icon': '💎',
                'description': '100% score on 3+ exams',
                'key': 'perfectionist',
                'earned': 'perfectionist' in earned_badges
            },
            {
                'name': 'Conversationalist',
                'icon': '💭',
                'description': '50+ conversations with AI',
                'key': 'conversationalist',
                'earned': 'conversationalist' in earned_badges
            },
            {
                'name': 'Confident',
                'icon': '🌟',
                'description': '80%+ overall confidence',
                'key': 'confident',
                'earned': 'confident' in earned_badges
            },
            {
                'name': 'Expert',
                'icon': '🏆',
                'description': '95%+ overall confidence',
                'key': 'expert',
                'earned': 'expert' in earned_badges
            }
        ]
        
        return jsonify({
            'success': True,
            'badges': available_badges,
            'earned_count': len(earned_badges),
            'total_count': len(available_badges)
        })
        
    except Exception as e:
        print(f"Error fetching badges: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Failed to fetch badges: {str(e)}'
        }), 500


@user_data_bp.route('/api/user/achievements', methods=['POST', 'OPTIONS'])
def get_user_achievements():
    """Get achievements for the current user - from database and auto-detected"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session.get('user_id')
    
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Fetch achievements from database
        achievements = list(mongo.db.achievements.find({'user_id': user_object_id}).sort('earned_at', -1).limit(20))
        
        # Format achievements for frontend
        formatted_achievements = []
        for achievement in achievements:
            formatted_achievements.append({
                'id': str(achievement.get('_id')),
                'key': achievement.get('key'),
                'name': achievement.get('name'),
                'description': achievement.get('description'),
                'icon': achievement.get('icon'),
                'earned_at': achievement.get('earned_at').isoformat() if achievement.get('earned_at') else None,
                'date': achievement.get('earned_at').strftime('%Y-%m-%d') if achievement.get('earned_at') else None,
                'created_at': achievement.get('created_at').isoformat() if achievement.get('created_at') else None
            })
        
        return jsonify({
            'success': True,
            'achievements': formatted_achievements,
            'total_count': len(formatted_achievements)
        })
        
    except Exception as e:
        print(f"Error fetching achievements: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Failed to fetch achievements: {str(e)}'
        }), 500


@user_data_bp.route('/api/classroom/progress/<classroom_id>', methods=['GET', 'POST', 'OPTIONS'])
def get_classroom_progress(classroom_id):
    """Get progress for a specific classroom"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session.get('user_id')
    
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Verify classroom belongs to user
        classroom = mongo.db.classrooms.find_one({
            '_id': ObjectId(classroom_id),
            'user_id': user_object_id
        })
        
        if not classroom:
            return jsonify({'success': False, 'message': 'Classroom not found'}), 404
        
        # Calculate progress
        progress_data = calculate_classroom_progress(user_id, classroom_id)
        
        # Ensure progress is a valid number between 0 and 100
        calculated_progress = progress_data.get('progress', 0)
        
        # Handle None, NaN, or invalid values
        if calculated_progress is None:
            calculated_progress = 0.0
        try:
            calculated_progress = float(calculated_progress)
            if math.isnan(calculated_progress):
                calculated_progress = 0.0
        except (ValueError, TypeError):
            calculated_progress = 0.0
        
        # Ensure between 0-100
        calculated_progress = max(0.0, min(100.0, calculated_progress))
        
        # Update progress in the progress_data
        progress_data['progress'] = calculated_progress
        
        # Update classroom progress in database
        mongo.db.classrooms.update_one(
            {'_id': ObjectId(classroom_id)},
            {'$set': {'progress': calculated_progress, 'updated_at': datetime.utcnow()}}
        )
        
        print(f"Calculated progress for classroom {classroom_id}: {calculated_progress}%")
        
        return jsonify({
            'success': True,
            'progress': progress_data
        })
        
    except Exception as e:
        print(f"Error getting classroom progress: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Failed to get classroom progress: {str(e)}'
        }), 500


@user_data_bp.route('/api/user/track-classroom-click', methods=['POST', 'OPTIONS'])
def track_classroom_click():
    """Track when user clicks on a classroom"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    data = request.get_json() or {}
    classroom_id = data.get('classroom_id')
    
    if not classroom_id:
        return jsonify({'success': False, 'message': 'Classroom ID required'}), 400
    
    try:
        user_id = session.get('user_id')
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Log the click (you can store this in a clicks/analytics collection)
        click_data = {
            'user_id': user_object_id,
            'classroom_id': classroom_id,
            'clicked_at': datetime.utcnow(),
            'timestamp': datetime.utcnow()
        }
        
        # Optional: Store in analytics collection
        # mongo.db.classroom_clicks.insert_one(click_data)
        
        print(f"User {user_id} clicked on classroom {classroom_id}")
        
        return jsonify({
            'success': True,
            'message': 'Click tracked'
        })
        
    except Exception as e:
        print(f"Error tracking classroom click: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to track click: {str(e)}'
        }), 500


@user_data_bp.route('/api/user/exam-results', methods=['POST', 'OPTIONS'])
def get_exam_results():
    """Get exam results for progress analysis"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session.get('user_id')
    
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Fetch all exam results for this user
        results = list(mongo.db.exam_results.find({'user_id': user_object_id}).sort('created_at', -1))
        
        # Calculate statistics
        total_exams = len(results)
        if total_exams > 0:
            total_score = sum(r.get('score', 0) for r in results)
            avg_score = total_score / total_exams
            total_correct = sum(r.get('correct_answers', 0) for r in results)
            total_questions = sum(r.get('total_questions', 0) for r in results)
            
            # Get subject-wise breakdown
            subject_stats = {}
            for result in results:
                exam = mongo.db.exams.find_one({'_id': ObjectId(result.get('exam_id'))})
                if exam:
                    subject = exam.get('subject', 'General')
                    if subject not in subject_stats:
                        subject_stats[subject] = {'count': 0, 'total_score': 0, 'total_questions': 0, 'correct': 0}
                    subject_stats[subject]['count'] += 1
                    subject_stats[subject]['total_score'] += result.get('score', 0)
                    subject_stats[subject]['total_questions'] += result.get('total_questions', 0)
                    subject_stats[subject]['correct'] += result.get('correct_answers', 0)
            
            # Format results
            formatted_results = []
            for result in results[:10]:  # Latest 10 results
                formatted_results.append({
                    'id': str(result.get('_id')),
                    'exam_title': result.get('exam_title', ''),
                    'score': result.get('score', 0),
                    'correct_answers': result.get('correct_answers', 0),
                    'total_questions': result.get('total_questions', 0),
                    'time_used_minutes': result.get('time_used_minutes', 0),
                    'created_at': result.get('created_at').isoformat() if result.get('created_at') else None,
                })
            
            # Format subject stats
            subject_breakdown = []
            for subject, stats in subject_stats.items():
                subject_breakdown.append({
                    'subject': subject,
                    'exam_count': stats['count'],
                    'average_score': round(stats['total_score'] / stats['count'], 1) if stats['count'] > 0 else 0,
                    'total_questions': stats['total_questions'],
                    'total_correct': stats['correct'],
                })
            
            return jsonify({
                'success': True,
                'statistics': {
                    'total_exams': total_exams,
                    'average_score': round(avg_score, 1),
                    'total_questions': total_questions,
                    'total_correct': total_correct,
                    'overall_accuracy': round((total_correct / total_questions * 100), 1) if total_questions > 0 else 0,
                },
                'subject_breakdown': subject_breakdown,
                'recent_results': formatted_results,
            })
        else:
            return jsonify({
                'success': True,
                'statistics': {
                    'total_exams': 0,
                    'average_score': 0,
                    'total_questions': 0,
                    'total_correct': 0,
                    'overall_accuracy': 0,
                },
                'subject_breakdown': [],
                'recent_results': [],
            })
        
    except Exception as e:
        print(f"Error fetching exam results: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Failed to fetch exam results: {str(e)}'
        }), 500


@user_data_bp.route('/api/user/progress', methods=['POST', 'OPTIONS'])
def get_user_progress():
    """Get comprehensive user progress including exams, chats, and documents"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session.get('user_id')
    
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Get exam results
        exam_results = list(mongo.db.exam_results.find({'user_id': user_object_id}))
        total_exams = len(exam_results)
        exam_progress = 0
        if exam_results:
            exam_progress = sum(r.get('score', 0) for r in exam_results) / len(exam_results)
        
        # Get chat activity - count unique chat sessions (conversations by date)
        # A chat session is defined by unique dates when user had conversations
        all_chats = list(mongo.db.chats.find({'user_id': user_object_id, 'role': 'user'}).sort('timestamp', -1))
        recent_chats = all_chats[:10] if len(all_chats) > 10 else all_chats
        
        # Count unique chat sessions (conversations) by grouping by date
        chat_sessions = set()
        for chat in all_chats:
            chat_date = chat.get('timestamp')
            if chat_date:
                if isinstance(chat_date, datetime):
                    chat_sessions.add(chat_date.date())
                else:
                    try:
                        chat_sessions.add(datetime.fromisoformat(str(chat_date)).date())
                    except:
                        pass
        
        # Total chat messages count
        chat_count = len(all_chats)
        # Unique chat sessions count (conversations)
        total_chat_sessions = len(chat_sessions) if chat_sessions else 0
        
        # Get document uploads
        document_count = mongo.db.documents.count_documents({'user_id': user_object_id})
        
        # Get classrooms
        classroom_count = mongo.db.classrooms.count_documents({'user_id': user_object_id})
        
        # Get profile
        profile = mongo.db.profiles.find_one({'user_id': user_object_id})
        
        # Calculate learning streak (days with activity)
        if recent_chats:
            last_chat_date = recent_chats[0].get('timestamp')
            if last_chat_date:
                today = datetime.utcnow().date()
                last_date = last_chat_date.date() if isinstance(last_chat_date, datetime) else datetime.fromisoformat(str(last_chat_date)).date()
                if today == last_date:
                    streak = 1  # At least 1 day if activity today
                else:
                    streak = 0
            else:
                streak = 0
        else:
            streak = 0
        
        return jsonify({
            'success': True,
            'progress': {
                'overall_progress': round(exam_progress, 1),
                'total_exams': total_exams,
                'total_chats': total_chat_sessions,  # Count of unique chat sessions (conversations), not total messages
                'total_chat_messages': chat_count,  # Total messages for reference
                'total_documents': document_count,
                'total_classrooms': classroom_count,
                'current_streak': streak,
                'longest_streak': profile.get('longest_streak', 0) if profile else 0,
            },
            'recent_activity': {
                'recent_chats': len(recent_chats),
                'last_activity': recent_chats[0].get('timestamp').isoformat() if recent_chats and recent_chats[0].get('timestamp') else None,
            }
        })
        
    except Exception as e:
        print(f"Error fetching user progress: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Failed to fetch progress: {str(e)}'
        }), 500


@user_data_bp.route('/api/leaderboard', methods=['GET', 'POST', 'OPTIONS'])
def get_leaderboard():
    """Get leaderboard with all users and their performance scores"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'error': 'Authentication required'}), 401
    
    current_user_id = session.get('user_id')
    
    try:
        current_user_object_id = ObjectId(current_user_id) if isinstance(current_user_id, str) else current_user_id
        
        # Get all users
        all_users = list(mongo.db.users.find({}))
        
        # Calculate performance for each user
        leaderboard = []
        for user in all_users:
            user_id_str = str(user.get('_id'))
            user_object_id = user.get('_id')
            
            # Get user profile for name/avatar
            profile = mongo.db.profiles.find_one({'user_id': user_object_id})
            
            # Calculate performance score
            performance = get_user_performance_score(user_id_str)
            
            # Get user name from profile or user record
            user_name = 'Unknown User'
            if profile:
                user_name = profile.get('name') or profile.get('full_name') or user.get('name') or user.get('username', 'Unknown User')
            else:
                user_name = user.get('name') or user.get('username') or user.get('full_name', 'Unknown User')
            
            # Get avatar if available
            avatar = None
            if profile:
                avatar = profile.get('avatar')
            
            leaderboard.append({
                'user_id': user_id_str,
                'name': user_name,
                'avatar': avatar,
                'performance_score': performance['performance_score'],
                'exam_score': performance['exam_score'],
                'engagement_score': performance['engagement_score'],
                'overall_confidence': performance['overall_confidence'],
                'total_exams': performance['total_exams'],
                'average_exam_score': performance['average_exam_score'],
                'total_messages': performance['total_messages'],
                'is_current_user': user_id_str == current_user_id or str(user_object_id) == current_user_id
            })
        
        # Sort by performance score in descending order
        leaderboard.sort(key=lambda x: x['performance_score'], reverse=True)
        
        # Add rank to each entry
        for idx, entry in enumerate(leaderboard, start=1):
            entry['rank'] = idx
        
        return jsonify({
            'success': True,
            'leaderboard': leaderboard,
            'current_user_id': current_user_id
        })
        
    except Exception as e:
        print(f"Error getting leaderboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@user_data_bp.route('/api/student/analysis', methods=['GET', 'POST', 'OPTIONS'])
def get_student_analysis():
    """Get comprehensive analysis combining exams and conversations for complete journey tracking"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'user_id' not in session:
        return jsonify({'error': 'Authentication required'}), 401

    user_id = session.get('user_id')

    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Analyze both conversations and exams
        conversation_data = analyze_conversation_engagement(user_id)
        exam_data = analyze_exam_performance(user_id)
        
        # Calculate overall confidence
        overall_confidence = calculate_overall_confidence(user_id, exam_data, conversation_data)
        
        # Detect and award new achievements
        new_achievements = detect_achievements(user_id, exam_data, conversation_data, overall_confidence)
        
        # Calculate badges
        earned_badges = calculate_badges(user_id, exam_data, conversation_data, overall_confidence)
        
        # Save confidence history for trend tracking
        save_confidence_history(user_id, overall_confidence, exam_data, conversation_data)
        
        # Get confidence trend
        confidence_trend = get_confidence_trend(user_id, days=30)
        
        # Fetch all exam results for detailed analysis
        results = list(mongo.db.exam_results.find({'user_id': user_object_id}).sort('created_at', -1))

        # Calculate subject confidence from exam data
        subject_confidence = {}
        subject_performance = {}
        
        if exam_data.get('subject_breakdown'):
            for subject, stats in exam_data['subject_breakdown'].items():
                avg_score = round(stats['total_score'] / stats['count'], 1) if stats['count'] > 0 else 0
                accuracy = round((stats['correct'] / max(stats['total_questions'], 1)) * 100, 1) if stats['total_questions'] > 0 else 0
                
                # Calculate confidence for this subject
                # Based on: average score (70%) + accuracy (30%)
                subject_conf = round((avg_score * 0.7) + (accuracy * 0.3))
                
                subject_performance[subject] = avg_score
                subject_confidence[subject] = {
                    'confidence_level': max(0, min(100, subject_conf)),
                    'average_score': avg_score,
                    'exam_count': stats['count'],
                    'total_questions': stats['total_questions'],
                    'correct_answers': stats['correct'],
                    'accuracy_rate': accuracy
                }
        
        if not results and conversation_data.get('total_messages', 0) == 0:
            return jsonify({
                'success': False,
                'message': 'Start learning! Take exams or chat with AI to see your analysis!',
                'overall_stats': {
                    'total_exams': 0,
                    'average_score': 0,
                    'total_questions_attempted': 0,
                    'total_correct_answers': 0,
                    'accuracy_rate': 0,
                    'overall_progress': 0,
                    'overall_confidence': 0
                },
                'conversation_engagement': conversation_data,
                'exam_performance': exam_data,
                'subject_confidence': {},
                'subject_performance': {},
                'score_trend': [],
                'confidence_trend': [],
                'new_achievements': [],
                'earned_badges': [],
                'ai_feedback': {
                    'overall_feedback': 'Start taking exams and chatting with AI to track your progress!',
                    'strengths': [],
                    'areas_for_improvement': []
                }
            }), 200

        # Calculate overall statistics
        total_exams = len(results)
        total_score = 0
        total_questions_attempted = 0
        total_correct = 0

        # Subject-wise tracking with confidence calculation
        subject_stats = {}
        
        # Iterate through results to calculate stats
        for result in results:
            score = result.get('score', 0)
            total_score += score

            # Fixed: Handle 'analysis' as a list
            analysis_list = result.get('analysis', [])

            # If analysis is a list, count items
            if isinstance(analysis_list, list):
                total_questions_attempted += len(analysis_list)
                # Count correct answers from the list
                for item in analysis_list:
                    if isinstance(item, dict) and item.get('is_correct'):
                        total_correct += 1
            else:
                # Fallback if analysis is not a list
                total_questions_attempted += result.get('total_questions', 0)
                total_correct += result.get('correct_answers', 0)
            
            # Get subject from exam
            exam_id = result.get('exam_id')
            subject = 'General'
            if exam_id:
                try:
                    exam = mongo.db.exams.find_one({'_id': ObjectId(exam_id)})
                    if exam:
                        subject = exam.get('subject', 'General')
                except:
                    pass
            
            # Track subject performance
            if subject not in subject_stats:
                subject_stats[subject] = {
                    'total_score': 0,
                    'count': 0,
                    'total_questions': 0,
                    'correct_answers': 0,
                    'scores': []
                }
            
            subject_stats[subject]['total_score'] += score
            subject_stats[subject]['count'] += 1
            subject_stats[subject]['scores'].append(score)
            subject_stats[subject]['total_questions'] += result.get('total_questions', 0)
            subject_stats[subject]['correct_answers'] += result.get('correct_answers', 0)

        avg_score = round(total_score / total_exams, 1) if total_exams > 0 else 0

        # Get latest exam result for detailed analysis
        latest_result = results[0]
        latest_score = latest_result.get('score', 0)
        latest_exam_title = latest_result.get('exam_title', 'Recent Exam')

        # Extract AI analysis from latest exam if available
        ai_analysis = latest_result.get('ai_analysis')

        # If ai_analysis is None or empty, use defaults
        if ai_analysis is None:
            ai_analysis = {}

        # Handle ai_analysis - it might be a string or dict
        if isinstance(ai_analysis, str):
            try:
                ai_analysis = json.loads(ai_analysis)
            except:
                ai_analysis = {}

        # Ensure it's a dict before calling .get()
        if not isinstance(ai_analysis, dict):
            ai_analysis = {}

        # Now safely get values from ai_analysis
        overall_feedback = ai_analysis.get('overall_feedback', 'Keep practicing to improve your performance!')
        strengths = ai_analysis.get('strengths', [])
        areas_for_improvement = ai_analysis.get('areas_for_improvement', [])

        # Handle cases where strengths/areas_for_improvement might be strings
        if isinstance(strengths, str):
            strengths = [strengths] if strengths else []
        if isinstance(areas_for_improvement, str):
            areas_for_improvement = [areas_for_improvement] if areas_for_improvement else []

        # Ensure they are lists
        if not isinstance(strengths, list):
            strengths = []
        if not isinstance(areas_for_improvement, list):
            areas_for_improvement = []

        # Track performance trends (last 5 exams)
        recent_exams = results[:5]
        score_trend = [r.get('score', 0) for r in reversed(recent_exams)]

        # Calculate subject-wise performance and confidence
        subject_performance = {}
        subject_confidence = {}
        
        for subject, stats in subject_stats.items():
            avg_subject_score = round(stats['total_score'] / stats['count'], 1) if stats['count'] > 0 else 0
            subject_performance[subject] = avg_subject_score
            
            # Calculate confidence based on:
            # - Average score (weight: 60%)
            # - Consistency (how stable scores are, weight: 20%)
            # - Number of exams taken (weight: 20%)
            
            score_avg = avg_subject_score
            
            # Calculate consistency (lower standard deviation = higher consistency)
            if len(stats['scores']) > 1:
                scores = stats['scores']
                mean = sum(scores) / len(scores)
                variance = sum((x - mean) ** 2 for x in scores) / len(scores)
                std_dev = variance ** 0.5
                # Higher consistency = lower std dev, scale to 0-100
                consistency = max(0, 100 - (std_dev * 2))  # Rough scaling
            else:
                consistency = 50  # Default for single exam
            
            # Number of exams factor (more exams = more confidence in assessment)
            exam_count_factor = min(100, stats['count'] * 20)  # Max at 5+ exams
            
            # Weighted confidence calculation
            confidence = round(
                (score_avg * 0.6) + 
                (consistency * 0.2) + 
                (exam_count_factor * 0.2)
            )
            
            # Clamp between 0-100
            confidence = max(0, min(100, confidence))
            
            subject_confidence[subject] = {
                'confidence_level': confidence,
                'average_score': avg_subject_score,
                'exam_count': stats['count'],
                'total_questions': stats['total_questions'],
                'correct_answers': stats['correct_answers'],
                'accuracy_rate': round((stats['correct_answers'] / max(stats['total_questions'], 1)) * 100, 1)
            }

        # Calculate accuracy rate safely
        accuracy_rate = round((total_correct / max(total_questions_attempted, 1)) * 100, 1)
        
        # Calculate overall progress (use overall_confidence from analysis service)
        overall_progress = overall_confidence

        # Store/Update progress in user profile
        try:
            profile = mongo.db.profiles.find_one({'user_id': user_object_id})
            if profile:
                mongo.db.profiles.update_one(
                    {'user_id': user_object_id},
                    {'$set': {
                        'total_progress': overall_progress,
                        'subject_confidence': subject_confidence,
                        'overall_confidence': overall_confidence,
                        'last_analysis_update': datetime.utcnow()
                    }}
                )
            else:
                # Create profile entry if doesn't exist
                mongo.db.profiles.insert_one({
                    'user_id': user_object_id,
                    'total_progress': overall_progress,
                    'overall_confidence': overall_confidence,
                    'subject_confidence': subject_confidence,
                    'last_analysis_update': datetime.utcnow(),
                    'created_at': datetime.utcnow()
                })
        except Exception as e:
            print(f"Error updating profile with progress: {e}")

        # Prepare comprehensive response
        analysis_data = {
            'success': True,
            'overall_stats': {
                'total_exams': total_exams,
                'average_score': avg_score,
                'total_questions_attempted': total_questions_attempted,
                'total_correct_answers': total_correct,
                'accuracy_rate': accuracy_rate,
                'overall_progress': overall_progress,
                'overall_confidence': overall_confidence
            },
            'conversation_engagement': conversation_data,
            'exam_performance': exam_data,
            'latest_exam': {
                'title': latest_exam_title,
                'score': latest_score,
                'date': latest_result.get('created_at').strftime('%Y-%m-%d %H:%M') if latest_result.get('created_at') else 'N/A'
            },
            'ai_feedback': {
                'overall_feedback': overall_feedback,
                'strengths': strengths if strengths else ['Complete more exams for detailed analysis'],
                'areas_for_improvement': areas_for_improvement if areas_for_improvement else ['Keep practicing regularly']
            },
            'score_trend': score_trend,
            'confidence_trend': confidence_trend,
            'subject_performance': subject_performance,
            'subject_confidence': subject_confidence,
            'earned_badges': earned_badges,
            'new_achievements': [serialize_doc(a) for a in new_achievements] if new_achievements else []
        }

        return jsonify(analysis_data)

    except Exception as e:
        print(f"Error in student analysis: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500

