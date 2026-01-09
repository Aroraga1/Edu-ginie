"""
Service for calculating classroom-specific progress based on conversations and exams
"""
from datetime import datetime, timedelta
from bson import ObjectId
from ..extensions import mongo


def calculate_classroom_progress(user_id, classroom_id):
    """
    Calculate progress for a specific classroom based on:
    - Conversation activity (messages, engagement)
    - Exam performance (scores, attempts)
    - Overall engagement metrics
    
    Returns a progress value from 0-100
    """
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        classroom_object_id = ObjectId(classroom_id) if isinstance(classroom_id, str) else classroom_id
        
        # Get classroom info
        classroom = mongo.db.classrooms.find_one({'_id': classroom_object_id, 'user_id': user_object_id})
        if not classroom:
            return {
                'progress': 0,
                'conversation_score': 0,
                'exam_score': 0,
                'details': {
                    'total_messages': 0,
                    'total_exams': 0,
                    'average_exam_score': 0,
                    'engagement_level': 'low'
                }
            }
        
        classroom_topic = classroom.get('topic') or classroom.get('name', '')
        
        # 1. Analyze conversation activity for this classroom
        conversation_query = {
            'user_id': user_object_id,
            '$or': [
                {'classroom_id': str(classroom_id)},
                {'classroom_id': classroom_object_id},
                {'topic': classroom_topic}
            ]
        }
        
        chats = list(mongo.db.chats.find(conversation_query).sort('timestamp', -1))
        print(f"Found {len(chats)} chats for classroom {classroom_id}")
        print(f"Query used: {conversation_query}")
        
        user_messages = [c for c in chats if c.get('role') == 'user']
        total_messages = len(user_messages)
        ai_responses = len([c for c in chats if c.get('role') == 'assistant'])
        
        # Calculate conversation engagement score (0-50 points)
        # Based on: message count, response ratio, recent activity
        if total_messages > 0:
            message_score = min(20, (total_messages / 20) * 20)  # Max 20 points for 20+ messages
            response_ratio = min(10, (ai_responses / max(total_messages, 1)) * 10)  # Max 10 points for good response ratio
            interaction_score = min(20, ((total_messages + ai_responses) / 30) * 20)  # Max 20 points for interactions
            conversation_score = min(50, message_score + response_ratio + interaction_score)
        else:
            conversation_score = 0
        
        # 2. Analyze exam performance for this classroom
        # Get exams for this classroom (match both string and ObjectId formats)
        exams = list(mongo.db.exams.find({
            'user_id': user_object_id,
            '$or': [
                {'classroom_id': str(classroom_id)},
                {'classroom_id': classroom_object_id},
                {'classroom_id': ObjectId(classroom_id) if isinstance(classroom_id, str) else classroom_id}
            ]
        }))
        
        print(f"Found {len(exams)} exams for classroom {classroom_id}")
        
        exam_ids = [exam['_id'] for exam in exams]
        
        # Get exam results for these exams
        exam_results = []
        if exam_ids:
            # Query with both ObjectId and string formats for exam_id
            exam_results = list(mongo.db.exam_results.find({
                'user_id': user_object_id,
                'exam_id': {'$in': exam_ids}
            }))
            print(f"Found {len(exam_results)} exam results for {len(exam_ids)} exams")
        
        total_exams = len(exam_results)
        exam_score = 0
        
        if total_exams > 0:
            total_score_sum = sum(r.get('score', 0) for r in exam_results)
            average_score = total_score_sum / total_exams
            
            # Exam score (0-50 points)
            # Based on: number of exams (15 points) + average score (35 points)
            exam_count_score = min(15, (total_exams / 5) * 15)  # Max 15 points for 5+ exams
            average_score_points = (average_score / 100) * 35  # Max 35 points for 100% average
            exam_score = exam_count_score + average_score_points
        else:
            average_score = 0
        
        # 3. Calculate overall progress (conversation + exam)
        overall_progress = conversation_score + exam_score
        
        # 4. Determine engagement level
        if overall_progress >= 80:
            engagement_level = 'excellent'
        elif overall_progress >= 60:
            engagement_level = 'good'
        elif overall_progress >= 40:
            engagement_level = 'moderate'
        elif overall_progress >= 20:
            engagement_level = 'low'
        else:
            engagement_level = 'minimal'
        
        # 5. Recent activity bonus (up to 10 points)
        recent_threshold = datetime.utcnow() - timedelta(days=7)
        recent_chats = [c for c in chats if c.get('timestamp') and c.get('timestamp') >= recent_threshold]
        recent_exams = [r for r in exam_results if r.get('created_at') and r.get('created_at') >= recent_threshold]
        
        recent_activity_bonus = 0
        if recent_chats or recent_exams:
            if len(recent_chats) >= 5 or len(recent_exams) >= 1:
                recent_activity_bonus = 10
            elif len(recent_chats) >= 2 or len(recent_exams) >= 1:
                recent_activity_bonus = 5
        
        final_progress = min(100, max(0, overall_progress + recent_activity_bonus))
        
        # Ensure all values are valid numbers
        return {
            'progress': round(float(final_progress), 1),
            'conversation_score': round(float(conversation_score), 1),
            'exam_score': round(float(exam_score), 1),
            'recent_activity_bonus': recent_activity_bonus,
            'details': {
                'total_messages': total_messages,
                'total_conversations': len(set(c.get('timestamp').date() if isinstance(c.get('timestamp'), datetime) else datetime.fromisoformat(str(c.get('timestamp'))).date() for c in chats if c.get('timestamp'))),
                'total_exams': total_exams,
                'average_exam_score': round(float(average_score), 1) if average_score else 0.0,
                'engagement_level': engagement_level,
                'ppt_generated': len([c for c in chats if c.get('ppt_data')]),
                'recent_activity_days': len(set(c.get('timestamp').date() if isinstance(c.get('timestamp'), datetime) else datetime.fromisoformat(str(c.get('timestamp'))).date() for c in recent_chats if c.get('timestamp')))
            }
        }
        
    except Exception as e:
        print(f"Error calculating classroom progress: {e}")
        import traceback
        traceback.print_exc()
        return {
            'progress': 0,
            'conversation_score': 0,
            'exam_score': 0,
            'details': {
                'total_messages': 0,
                'total_exams': 0,
                'average_exam_score': 0,
                'engagement_level': 'minimal'
            },
            'error': str(e)
        }

