"""Comprehensive analysis service combining exams and conversations for student journey tracking"""
import json
from datetime import datetime, timedelta
from bson import ObjectId
from ..extensions import mongo


def analyze_conversation_engagement(user_id):
    """Analyze conversation engagement metrics"""
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Get all conversations
        chats = list(mongo.db.chats.find({'user_id': user_object_id}).sort('timestamp', -1))
        
        if not chats:
            return {
                'total_messages': 0,
                'total_conversations': 0,
                'avg_message_length': 0,
                'topics_covered': 0,
                'engagement_score': 0,
                'recent_activity_days': 0,
                'ppt_generated': 0
            }
        
        # Calculate metrics
        user_messages = [c for c in chats if c.get('role') == 'user']
        total_messages = len(user_messages)
        total_conversations = len(set(c.get('topic', 'general') for c in chats))
        
        # Average message length
        message_lengths = [len(c.get('message', '')) for c in user_messages]
        avg_message_length = sum(message_lengths) / len(message_lengths) if message_lengths else 0
        
        # Count PPTs generated
        ppt_generated = sum(1 for c in chats if c.get('ppt_data'))
        
        # Topics covered (from different topics)
        topics = set()
        for chat in chats:
            topic = chat.get('topic') or chat.get('pdf_context', {}).get('topic') or 'general'
            topics.add(topic)
        
        # Recent activity (last 7 days)
        recent_threshold = datetime.utcnow() - timedelta(days=7)
        recent_chats = [c for c in chats if c.get('timestamp') and c.get('timestamp') >= recent_threshold]
        recent_activity_days = len(set(c.get('timestamp').date() if isinstance(c.get('timestamp'), datetime) else datetime.fromisoformat(str(c.get('timestamp'))).date() for c in recent_chats if c.get('timestamp')))
        
        # Engagement score (0-100) based on:
        # - Message count (30%)
        # - Conversation diversity (20%)
        # - Recent activity (30%)
        # - PPT generation (20%)
        message_score = min(100, (total_messages / 50) * 100)  # Max at 50 messages
        diversity_score = min(100, (len(topics) / 10) * 100)  # Max at 10 topics
        activity_score = min(100, (recent_activity_days / 7) * 100)  # Max at 7 days
        ppt_score = min(100, (ppt_generated / 5) * 100)  # Max at 5 PPTs
        
        engagement_score = round(
            (message_score * 0.3) +
            (diversity_score * 0.2) +
            (activity_score * 0.3) +
            (ppt_score * 0.2)
        )
        
        return {
            'total_messages': total_messages,
            'total_conversations': total_conversations,
            'avg_message_length': round(avg_message_length, 1),
            'topics_covered': len(topics),
            'engagement_score': engagement_score,
            'recent_activity_days': recent_activity_days,
            'ppt_generated': ppt_generated,
            'topics_list': list(topics)[:10]  # Top 10 topics
        }
    except Exception as e:
        print(f"Error analyzing conversation engagement: {e}")
        return {
            'total_messages': 0,
            'total_conversations': 0,
            'avg_message_length': 0,
            'topics_covered': 0,
            'engagement_score': 0,
            'recent_activity_days': 0,
            'ppt_generated': 0
        }


def analyze_exam_performance(user_id):
    """Analyze exam performance metrics"""
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Get all exam results
        results = list(mongo.db.exam_results.find({'user_id': user_object_id}).sort('created_at', -1))
        
        if not results:
            return {
                'total_exams': 0,
                'average_score': 0,
                'total_questions': 0,
                'correct_answers': 0,
                'accuracy_rate': 0,
                'performance_score': 0,
                'improvement_trend': 0,
                'perfect_scores': 0,
                'subject_breakdown': {}
            }
        
        # Calculate basic stats
        total_exams = len(results)
        total_score = sum(r.get('score', 0) for r in results)
        average_score = round(total_score / total_exams, 1) if total_exams > 0 else 0
        
        total_questions = sum(r.get('total_questions', 0) for r in results)
        correct_answers = sum(r.get('correct_answers', 0) for r in results)
        accuracy_rate = round((correct_answers / total_questions * 100), 1) if total_questions > 0 else 0
        
        # Count perfect scores
        perfect_scores = sum(1 for r in results if r.get('score', 0) >= 100)
        
        # Calculate improvement trend (comparing first half vs second half)
        if total_exams >= 4:
            mid_point = total_exams // 2
            first_half = results[mid_point:]
            second_half = results[:mid_point]
            
            first_avg = sum(r.get('score', 0) for r in first_half) / len(first_half) if first_half else 0
            second_avg = sum(r.get('score', 0) for r in second_half) / len(second_half) if second_half else 0
            
            improvement_trend = round(second_avg - first_avg, 1)
        else:
            improvement_trend = 0
        
        # Subject breakdown
        subject_breakdown = {}
        for result in results:
            exam_id = result.get('exam_id')
            if exam_id:
                try:
                    exam = mongo.db.exams.find_one({'_id': ObjectId(exam_id)})
                    if exam:
                        subject = exam.get('subject', 'General')
                        if subject not in subject_breakdown:
                            subject_breakdown[subject] = {
                                'count': 0,
                                'total_score': 0,
                                'total_questions': 0,
                                'correct': 0
                            }
                        subject_breakdown[subject]['count'] += 1
                        subject_breakdown[subject]['total_score'] += result.get('score', 0)
                        subject_breakdown[subject]['total_questions'] += result.get('total_questions', 0)
                        subject_breakdown[subject]['correct'] += result.get('correct_answers', 0)
                except:
                    pass
        
        # Performance score (0-100) based on:
        # - Average score (50%)
        # - Accuracy rate (30%)
        # - Improvement trend (20%)
        performance_score = round(
            (average_score * 0.5) +
            (accuracy_rate * 0.3) +
            (max(0, min(100, 50 + improvement_trend)) * 0.2)
        )
        
        return {
            'total_exams': total_exams,
            'average_score': average_score,
            'total_questions': total_questions,
            'correct_answers': correct_answers,
            'accuracy_rate': accuracy_rate,
            'performance_score': performance_score,
            'improvement_trend': improvement_trend,
            'perfect_scores': perfect_scores,
            'subject_breakdown': subject_breakdown
        }
    except Exception as e:
        print(f"Error analyzing exam performance: {e}")
        return {
            'total_exams': 0,
            'average_score': 0,
            'total_questions': 0,
            'correct_answers': 0,
            'accuracy_rate': 0,
            'performance_score': 0,
            'improvement_trend': 0,
            'perfect_scores': 0,
            'subject_breakdown': {}
        }


def calculate_overall_confidence(user_id, exam_data, conversation_data):
    """Calculate overall confidence combining exam and conversation metrics"""
    try:
        # Weighted combination:
        # - Exam performance: 60%
        # - Conversation engagement: 40%
        
        exam_weight = 0.6
        conversation_weight = 0.4
        
        exam_score = exam_data.get('performance_score', 0)
        engagement_score = conversation_data.get('engagement_score', 0)
        
        overall_confidence = round(
            (exam_score * exam_weight) +
            (engagement_score * conversation_weight)
        )
        
        # Clamp between 0-100
        overall_confidence = max(0, min(100, overall_confidence))
        
        return overall_confidence
    except Exception as e:
        print(f"Error calculating overall confidence: {e}")
        return 0


def detect_achievements(user_id, exam_data, conversation_data, overall_confidence):
    """Detect and award achievements based on milestones"""
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Get existing achievements
        existing_achievements = mongo.db.achievements.find({'user_id': user_object_id})
        existing_keys = set(a.get('key') for a in existing_achievements if a.get('key'))
        
        new_achievements = []
        
        # Achievement definitions
        achievement_definitions = [
            {
                'key': 'first_exam',
                'name': 'First Steps',
                'description': 'Completed your first exam',
                'icon': '🎯',
                'condition': lambda ed, cd, oc: ed.get('total_exams', 0) >= 1
            },
            {
                'key': 'first_conversation',
                'name': 'Chat Starter',
                'description': 'Started your first conversation with AI',
                'icon': '💬',
                'condition': lambda ed, cd, oc: cd.get('total_messages', 0) >= 1
            },
            {
                'key': 'quick_learner',
                'name': 'Quick Learner',
                'description': 'Completed 5 exams in a week',
                'icon': '⚡',
                'condition': lambda ed, cd, oc: ed.get('total_exams', 0) >= 5
            },
            {
                'key': 'perfectionist',
                'name': 'Perfectionist',
                'description': 'Scored 100% on 3 exams',
                'icon': '💎',
                'condition': lambda ed, cd, oc: ed.get('perfect_scores', 0) >= 3
            },
            {
                'key': 'consistent',
                'name': 'Consistent Learner',
                'description': 'Active for 7 consecutive days',
                'icon': '📅',
                'condition': lambda ed, cd, oc: cd.get('recent_activity_days', 0) >= 7
            },
            {
                'key': 'explorer',
                'name': 'Topic Explorer',
                'description': 'Explored 10 different topics',
                'icon': '🗺️',
                'condition': lambda ed, cd, oc: cd.get('topics_covered', 0) >= 10
            },
            {
                'key': 'master',
                'name': 'Subject Master',
                'description': 'Achieved 90%+ in any subject',
                'icon': '👑',
                'condition': lambda ed, cd, oc: any(
                    (s.get('total_score', 0) / max(s.get('count', 1), 1)) >= 90
                    for s in ed.get('subject_breakdown', {}).values()
                )
            },
            {
                'key': 'conversationalist',
                'name': 'Conversationalist',
                'description': 'Sent 50+ messages',
                'icon': '💭',
                'condition': lambda ed, cd, oc: cd.get('total_messages', 0) >= 50
            },
            {
                'key': 'confident',
                'name': 'Confident Learner',
                'description': 'Reached 80% overall confidence',
                'icon': '🌟',
                'condition': lambda ed, cd, oc: oc >= 80
            },
            {
                'key': 'expert',
                'name': 'Expert',
                'description': 'Reached 95% overall confidence',
                'icon': '🏆',
                'condition': lambda ed, cd, oc: oc >= 95
            },
            {
                'key': 'ppt_creator',
                'name': 'Presentation Master',
                'description': 'Generated 5 PPTs',
                'icon': '📊',
                'condition': lambda ed, cd, oc: cd.get('ppt_generated', 0) >= 5
            },
            {
                'key': 'improver',
                'name': 'Continuous Improver',
                'description': 'Showed improvement trend of 10+ points',
                'icon': '📈',
                'condition': lambda ed, cd, oc: ed.get('improvement_trend', 0) >= 10
            }
        ]
        
        # Check each achievement
        for achievement in achievement_definitions:
            key = achievement['key']
            
            # Skip if already earned
            if key in existing_keys:
                continue
            
            # Check condition
            if achievement['condition'](exam_data, conversation_data, overall_confidence):
                # Award achievement
                achievement_doc = {
                    'user_id': user_object_id,
                    'key': key,
                    'name': achievement['name'],
                    'description': achievement['description'],
                    'icon': achievement['icon'],
                    'earned_at': datetime.utcnow(),
                    'created_at': datetime.utcnow()
                }
                
                mongo.db.achievements.insert_one(achievement_doc)
                new_achievements.append(achievement_doc)
        
        return new_achievements
    except Exception as e:
        print(f"Error detecting achievements: {e}")
        import traceback
        traceback.print_exc()
        return []


def calculate_badges(user_id, exam_data, conversation_data, overall_confidence):
    """Calculate which badges user has earned"""
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Get profile for streak data
        profile = mongo.db.profiles.find_one({'user_id': user_object_id})
        current_streak = profile.get('current_streak', 0) if profile else 0
        
        earned_badges = []
        
        # Badge definitions with conditions
        badge_definitions = [
            {
                'key': 'quick_learner',
                'name': 'Quick Learner',
                'icon': '⚡',
                'description': 'Completed 5 topics in one day',
                'earned': exam_data.get('total_exams', 0) >= 5
            },
            {
                'key': 'consistent',
                'name': 'Consistent',
                'icon': '📅',
                'description': f'{current_streak}-day learning streak',
                'earned': current_streak >= 7
            },
            {
                'key': 'math_master',
                'name': 'Math Master',
                'icon': '🔢',
                'description': 'Achieved 90%+ in mathematics',
                'earned': any(
                    subject.lower() == 'mathematics' and
                    (s.get('total_score', 0) / max(s.get('count', 1), 1)) >= 90
                    for subject, s in exam_data.get('subject_breakdown', {}).items()
                )
            },
            {
                'key': 'ai_explorer',
                'name': 'AI Explorer',
                'icon': '🤖',
                'description': 'Completed AI fundamentals',
                'earned': any(
                    'ai' in subject.lower() or 'artificial intelligence' in subject.lower()
                    for subject in exam_data.get('subject_breakdown', {}).keys()
                ) and exam_data.get('total_exams', 0) >= 3
            },
            {
                'key': 'perfectionist',
                'name': 'Perfectionist',
                'icon': '💎',
                'description': '100% score on 3 exams',
                'earned': exam_data.get('perfect_scores', 0) >= 3
            },
            {
                'key': 'conversationalist',
                'name': 'Conversationalist',
                'icon': '💭',
                'description': '50+ conversations',
                'earned': conversation_data.get('total_messages', 0) >= 50
            },
            {
                'key': 'confident',
                'name': 'Confident',
                'icon': '🌟',
                'description': '80%+ overall confidence',
                'earned': overall_confidence >= 80
            },
            {
                'key': 'expert',
                'name': 'Expert',
                'icon': '🏆',
                'description': '95%+ overall confidence',
                'earned': overall_confidence >= 95
            }
        ]
        
        for badge in badge_definitions:
            if badge['earned']:
                earned_badges.append(badge['key'])
        
        # Update profile with earned badges
        if profile:
            mongo.db.profiles.update_one(
                {'user_id': user_object_id},
                {'$set': {'earned_badges': earned_badges}}
            )
        
        return earned_badges
    except Exception as e:
        print(f"Error calculating badges: {e}")
        return []


def save_confidence_history(user_id, overall_confidence, exam_data, conversation_data):
    """Save confidence history for trend tracking"""
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        confidence_entry = {
            'user_id': user_object_id,
            'confidence_level': overall_confidence,
            'exam_performance_score': exam_data.get('performance_score', 0),
            'engagement_score': conversation_data.get('engagement_score', 0),
            'total_exams': exam_data.get('total_exams', 0),
            'total_messages': conversation_data.get('total_messages', 0),
            'timestamp': datetime.utcnow(),
            'created_at': datetime.utcnow()
        }
        
        mongo.db.confidence_history.insert_one(confidence_entry)
        
        # Keep only last 100 entries per user
        all_entries = list(mongo.db.confidence_history.find({'user_id': user_object_id}).sort('timestamp', -1))
        if len(all_entries) > 100:
            entries_to_delete = all_entries[100:]
            for entry in entries_to_delete:
                mongo.db.confidence_history.delete_one({'_id': entry['_id']})
    except Exception as e:
        print(f"Error saving confidence history: {e}")


def get_confidence_trend(user_id, days=30):
    """Get confidence trend over time"""
    try:
        user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        history = list(mongo.db.confidence_history.find({
            'user_id': user_object_id,
            'timestamp': {'$gte': cutoff_date}
        }).sort('timestamp', 1))
        
        trend_data = []
        for entry in history:
            trend_data.append({
                'date': entry.get('timestamp').isoformat() if entry.get('timestamp') else None,
                'confidence': entry.get('confidence_level', 0),
                'exam_score': entry.get('exam_performance_score', 0),
                'engagement_score': entry.get('engagement_score', 0)
            })
        
        return trend_data
    except Exception as e:
        print(f"Error getting confidence trend: {e}")
        return []

