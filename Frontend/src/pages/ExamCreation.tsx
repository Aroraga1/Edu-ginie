import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  ArrowLeft, 
  PlusCircle, 
  Settings, 
  Play, 
  CheckCircle, 
  XCircle,
  Clock,
  Target,
  BarChart3,
  Trophy
} from 'lucide-react';
import { generateExam, getExam, submitExam } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const ExamCreation = () => {
  const [currentView, setCurrentView] = useState('create'); // 'create', 'exam', 'results'
  const [examConfig, setExamConfig] = useState({
    title: '',
    subject: '',
    topics: '',
    numberOfQuestions: 10,
    difficulty: '',
    type: '',
    timeLimit: 30
  });

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [examStarted, setExamStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30 * 60);
  const [examId, setExamId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Array<{
    question: string;
    options: string[];
    answer_index: number;
    explanation?: string;
  }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examResults, setExamResults] = useState<{
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    timeUsedMinutes: number;
    analysis: Array<{
      question_num: number;
      question: string;
      user_answer: number | null;
      correct_answer: number;
      is_correct: boolean;
      explanation?: string;
    }>;
  } | null>(null);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [startTime, setStartTime] = useState<number>(0);


  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examConfig.title || !examConfig.subject) {
      console.error("Missing exam title or subject");
      return;
    }

    if (!examConfig.difficulty || !examConfig.type) {
      console.error("Missing difficulty or question type");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await generateExam({
        title: examConfig.title,
        subject: examConfig.subject,
        topics: examConfig.topics || undefined,
        questionCount: examConfig.numberOfQuestions,
        difficulty: examConfig.difficulty,
        questionType: examConfig.type === 'multiple-choice' ? 'MCQ' : examConfig.type === 'true-false' ? 'True/False' : 'MCQ',
        timeLimit: examConfig.timeLimit,
      });

      if (response?.success && response?.exam_id) {
        setExamId(response.exam_id);
        // Fetch exam questions
        const examData = await getExam(response.exam_id);
        if (examData?.questions) {
          setQuestions(examData.questions);
          setTimeRemaining(examData.time_limit * 60);
          setCurrentView('exam');
        } else {
          throw new Error('Failed to load exam questions');
        }
      } else {
        throw new Error(response?.error || 'Failed to generate exam');
      }
    } catch (error: any) {
      console.error('Error generating exam:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartExam = () => {
    setExamStarted(true);
    setStartTime(Date.now());
    // Start timer
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setTimerInterval(timer);
  };

  const handleAnswerSelect = (value: string) => {
    setAnswers({
      ...answers,
      [currentQuestion]: parseInt(value)
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleFinishExam();
    }
  };

  const handleFinishExam = async () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }

    if (!examId) {
      console.error("Exam ID not found");
      return;
    }

    setIsSubmitting(true);
    try {
      const timeUsed = Math.floor((Date.now() - startTime) / 1000 / 60); // minutes
      const answersArray = questions.map((_, index) => answers[index] ?? -1);

      const response = await submitExam({
        exam_id: examId,
        answers: answersArray,
        time_used: timeUsed
      });

      if (response?.success) {
        // Fetch results - the submit endpoint doesn't return full results, so we'll calculate from submission
        // For now, let's fetch the exam again to get questions for display
        const examData = await getExam(examId);
        const totalQuestions = questions.length;
        let correct = 0;
        const analysis = questions.map((q, i) => {
          const userAnswer = answers[i];
          const correctAnswer = q.answer_index;
          const isCorrect = userAnswer === correctAnswer;
          if (isCorrect) correct++;
          return {
            question_num: i + 1,
            question: q.question,
            user_answer: userAnswer ?? null,
            correct_answer: correctAnswer,
            is_correct: isCorrect,
            explanation: q.explanation
          };
        });

        setExamResults({
          score: Math.round((correct / totalQuestions) * 100),
          correctAnswers: correct,
          totalQuestions: totalQuestions,
          timeUsedMinutes: timeUsed,
          analysis: analysis
        });

        setCurrentView('results');
      } else {
        throw new Error(response?.error || 'Failed to submit exam');
      }
    } catch (error: any) {
      console.error('Error submitting exam:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (currentView === 'results' && examResults) {
    const formatTime = (minutes: number) => {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}`;
      return `${mins} min`;
    };

    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gradient mb-4">Exam Results</h1>
            <p className="text-muted-foreground">Here's how you performed</p>
          </div>

          {/* Score Overview */}
          <Card className="bg-gradient-card border-border glow-card mb-8">
            <CardContent className="p-8 text-center">
              <div className="mb-6">
                <div className="text-6xl font-bold text-gradient mb-2">{examResults.score}%</div>
                <p className="text-xl text-muted-foreground">Overall Score</p>
              </div>
              
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-success">{examResults.correctAnswers}</div>
                  <div className="text-sm text-muted-foreground">Correct</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-destructive">{examResults.totalQuestions - examResults.correctAnswers}</div>
                  <div className="text-sm text-muted-foreground">Incorrect</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-warning">{formatTime(examResults.timeUsedMinutes)}</div>
                  <div className="text-sm text-muted-foreground">Time Used</div>
                </div>
              </div>

              <Progress value={examResults.score} className="h-4 mb-4" />
            </CardContent>
          </Card>

          {/* Detailed Feedback */}
          <Card className="bg-gradient-card border-border glow-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="mr-2 h-5 w-5 text-primary" />
                Question Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {examResults.analysis.map((item, index) => (
                  <div key={index} className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${
                          item.is_correct ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                        }`}>
                          {item.is_correct ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </div>
                        <span className="font-medium">Question {item.question_num}</span>
                      </div>
                      <div className="text-right">
                        {item.user_answer !== null ? (
                          <>
                            <div className="text-sm text-muted-foreground">
                              Your answer: Option {item.user_answer + 1}
                            </div>
                            {!item.is_correct && (
                              <div className="text-sm text-success">
                                Correct: Option {item.correct_answer + 1}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground">Not answered</div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{item.question}</p>
                    {item.explanation && (
                      <p className="text-xs text-muted-foreground italic">{item.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center space-x-4">
            <Button onClick={() => {
              setCurrentView('create');
              setExamId(null);
              setQuestions([]);
              setAnswers({});
              setExamResults(null);
            }} variant="outline">
              Create New Exam
            </Button>
            <Link to="/dashboard">
              <Button className="bg-gradient-primary hover:opacity-90">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'exam') {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="container mx-auto max-w-4xl">
          {!examStarted ? (
            // Exam Start Screen
            <div className="text-center">
              <Card className="bg-gradient-card border-border glow-card">
                <CardHeader>
                  <CardTitle className="text-3xl">{examConfig.title}</CardTitle>
                  <CardDescription className="text-lg">{examConfig.subject}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{examConfig.numberOfQuestions}</div>
                      <div className="text-sm text-muted-foreground">Questions</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{examConfig.timeLimit}</div>
                      <div className="text-sm text-muted-foreground">Minutes</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{examConfig.difficulty}</div>
                      <div className="text-sm text-muted-foreground">Level</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{examConfig.type}</div>
                      <div className="text-sm text-muted-foreground">Format</div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Instructions</h3>
                    <ul className="text-left space-y-2 text-muted-foreground">
                      <li>• Read each question carefully before selecting your answer</li>
                      <li>• You can navigate between questions using the Next/Previous buttons</li>
                      <li>• Your progress is automatically saved</li>
                      <li>• Make sure to submit your exam before time runs out</li>
                    </ul>
                  </div>

                  <Button 
                    onClick={handleStartExam}
                    size="lg"
                    className="bg-gradient-primary hover:opacity-90 glow-primary"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Start Exam
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            // Exam Interface
            <div>
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold">{examConfig.title}</h1>
                  <p className="text-muted-foreground">Question {currentQuestion + 1} of {questions.length}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center text-primary">
                    <Clock className="mr-2 h-4 w-4" />
                    <span className="font-mono text-lg">{formatTime(timeRemaining)}</span>
                  </div>
                  <Progress value={(currentQuestion + 1) / questions.length * 100} className="w-32" />
                </div>
              </div>

              {/* Question Card */}
              {questions.length > 0 && questions[currentQuestion] && (
                <>
                  <Card className="bg-gradient-card border-border glow-card mb-6">
                    <CardHeader>
                      <CardTitle className="text-xl">
                        {questions[currentQuestion].question}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RadioGroup
                        value={answers[currentQuestion]?.toString() || ''}
                        onValueChange={handleAnswerSelect}
                      >
                        {questions[currentQuestion].options.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2 p-3 hover:bg-muted/30 rounded-lg transition-smooth">
                            <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                            <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </CardContent>
                  </Card>

                  {/* Navigation */}
                  <div className="flex justify-between">
                    <Button 
                      variant="outline"
                      disabled={currentQuestion === 0}
                      onClick={() => setCurrentQuestion(currentQuestion - 1)}
                    >
                      Previous
                    </Button>
                    
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline"
                        onClick={handleFinishExam}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Finish Exam'
                        )}
                      </Button>
                      <Button 
                        onClick={handleNextQuestion}
                        className="bg-gradient-primary hover:opacity-90"
                        disabled={answers[currentQuestion] === undefined}
                      >
                        {currentQuestion === questions.length - 1 ? 'Submit' : 'Next'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero p-6">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Link to="/dashboard">
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/10 mr-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-gradient">Create Practice Exam</h1>
            <p className="text-muted-foreground">Design your personalized assessment</p>
          </div>
        </div>

        <form onSubmit={handleCreateExam} className="space-y-8">
          {/* Basic Configuration */}
          <Card className="bg-gradient-card border-border glow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5 text-primary" />
                Exam Configuration
              </CardTitle>
              <CardDescription>Set up the basic parameters for your exam</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Exam Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Machine Learning Fundamentals Quiz"
                    value={examConfig.title}
                    onChange={(e) => setExamConfig({...examConfig, title: e.target.value})}
                    className="bg-input border-border focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Select 
                    value={examConfig.subject} 
                    onValueChange={(value) => setExamConfig({...examConfig, subject: value})}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mathematics">Mathematics</SelectItem>
                      <SelectItem value="computer-science">Computer Science</SelectItem>
                      <SelectItem value="physics">Physics</SelectItem>
                      <SelectItem value="chemistry">Chemistry</SelectItem>
                      <SelectItem value="biology">Biology</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topics">Topics to Cover</Label>
                <Textarea
                  id="topics"
                  placeholder="List the specific topics or chapters to include in the exam..."
                  value={examConfig.topics}
                  onChange={(e) => setExamConfig({...examConfig, topics: e.target.value})}
                  className="bg-input border-border focus:ring-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* Question Settings */}
          <Card className="bg-gradient-card border-border glow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="mr-2 h-5 w-5 text-primary" />
                Question Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="numberOfQuestions">Number of Questions</Label>
                  <Select 
                    value={examConfig.numberOfQuestions.toString()} 
                    onValueChange={(value) => setExamConfig({...examConfig, numberOfQuestions: parseInt(value)})}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Questions</SelectItem>
                      <SelectItem value="10">10 Questions</SelectItem>
                      <SelectItem value="15">15 Questions</SelectItem>
                      <SelectItem value="20">20 Questions</SelectItem>
                      <SelectItem value="25">25 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select 
                    value={examConfig.difficulty} 
                    onValueChange={(value) => setExamConfig({...examConfig, difficulty: value})}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="mixed">Mixed Levels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Question Type</Label>
                  <Select 
                    value={examConfig.type} 
                    onValueChange={(value) => setExamConfig({...examConfig, type: value})}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                      <SelectItem value="true-false">True/False</SelectItem>
                      <SelectItem value="mixed">Mixed Format</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                <Select 
                  value={examConfig.timeLimit.toString()} 
                  onValueChange={(value) => setExamConfig({...examConfig, timeLimit: parseInt(value)})}
                >
                  <SelectTrigger className="bg-input border-border w-full md:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button 
              type="submit" 
              size="lg" 
              className="bg-gradient-primary hover:opacity-90 glow-primary px-12 py-4"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Exam...
                </>
              ) : (
                <>
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Generate Exam
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExamCreation;