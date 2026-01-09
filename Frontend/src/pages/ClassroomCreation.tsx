import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  BookOpen, 
  Target, 
  FileText, 
  Users, 
  Video, 
  Image, 
  Headphones,
  Brain,
  Zap,
  CheckCircle
} from 'lucide-react';
import { createClassroom } from '@/lib/api';

const ClassroomCreation = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    description: '',
    preparation: '',
    syllabus: '',
    mediaType: '',
    medium: '',
    confidenceLevel: [75]
  });

  const subjects = [
    'Mathematics', 'Computer Science', 'Physics', 'Chemistry', 'Biology',
    'History', 'Literature', 'Business', 'Economics', 'Psychology',
    'Languages', 'Art', 'Music', 'Engineering'
  ];

  const mediaTypes = [
    { value: 'pdf', label: 'PDF Documents', icon: FileText },
    { value: 'video', label: 'Video Content', icon: Video },
    { value: 'audio', label: 'Audio Materials', icon: Headphones },
    { value: 'images', label: 'Visual Content', icon: Image },
    { value: 'text', label: 'Text-based', icon: BookOpen }
  ];

  const mediums = [
    { value: 'interactive', label: 'Interactive Learning', description: 'Dynamic Q&A and discussions' },
    { value: 'visual', label: 'Visual Learning', description: 'Charts, diagrams, and presentations' },
    { value: 'audio', label: 'Audio Learning', description: 'Voice conversations and explanations' },
    { value: 'mixed', label: 'Mixed Media', description: 'Combination of all approaches' }
  ];

  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.subject) {
      console.error("Missing classroom name or subject");
      return;
    }

    setIsCreating(true);
    
    try {
      // Create classroom via API
      const response = await createClassroom({
        name: formData.name,
        subject: formData.subject,
        description: formData.description,
        preparation: formData.preparation,
        syllabus: formData.syllabus,
        mediaType: formData.mediaType,
        medium: formData.medium,
        confidenceLevel: formData.confidenceLevel
      });

      if (response?.success && response?.classroom) {
        // Redirect to dashboard with the new classroom ID
        navigate(`/dashboard?classroom=${response.classroom.id}`);
      } else {
        throw new Error(response?.message || 'Failed to create classroom');
      }
    } catch (error: any) {
      console.error('Error creating classroom:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-6">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Link to="/profile">
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/10 mr-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Profile
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-gradient">Create New Classroom</h1>
            <p className="text-muted-foreground">Set up your personalized learning environment</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <Card className="bg-gradient-card border-border glow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="mr-2 h-5 w-5 text-primary" />
                Basic Information
              </CardTitle>
              <CardDescription>Define the core details of your classroom</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Classroom Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Advanced Machine Learning"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="bg-input border-border focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Select 
                    value={formData.subject} 
                    onValueChange={(value) => setFormData({...formData, subject: value})}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what students will learn in this classroom..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="bg-input border-border focus:ring-primary min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Classroom Schema */}
          <Card className="bg-gradient-card border-border glow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="mr-2 h-5 w-5 text-primary" />
                Classroom Schema
              </CardTitle>
              <CardDescription>Define the learning structure and content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="preparation">Preparation Requirements</Label>
                <Textarea
                  id="preparation"
                  placeholder="What should students know before starting? Any prerequisites..."
                  value={formData.preparation}
                  onChange={(e) => setFormData({...formData, preparation: e.target.value})}
                  className="bg-input border-border focus:ring-primary"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="syllabus">Syllabus & Topics</Label>
                <Textarea
                  id="syllabus"
                  placeholder="List the main topics and learning objectives..."
                  value={formData.syllabus}
                  onChange={(e) => setFormData({...formData, syllabus: e.target.value})}
                  className="bg-input border-border focus:ring-primary min-h-[120px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Media and Medium */}
          <Card className="bg-gradient-card border-border glow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5 text-primary" />
                Learning Preferences
              </CardTitle>
              <CardDescription>Choose how you want to interact with the content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Primary Media Type</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {mediaTypes.map((media) => (
                    <button
                      key={media.value}
                      type="button"
                      onClick={() => setFormData({...formData, mediaType: media.value})}
                      className={`p-4 rounded-lg border text-left transition-smooth ${
                        formData.mediaType === media.value
                          ? 'border-primary bg-primary/10 glow-feature'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <media.icon className="h-6 w-6 text-primary mb-2" />
                      <div className="font-medium text-sm">{media.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Label>Learning Medium</Label>
                <div className="grid md:grid-cols-2 gap-4">
                  {mediums.map((medium) => (
                    <button
                      key={medium.value}
                      type="button"
                      onClick={() => setFormData({...formData, medium: medium.value})}
                      className={`p-4 rounded-lg border text-left transition-smooth ${
                        formData.medium === medium.value
                          ? 'border-primary bg-primary/10 glow-feature'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium mb-1">{medium.label}</div>
                      <div className="text-sm text-muted-foreground">{medium.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confidence Meter */}
          <Card className="bg-gradient-card border-border glow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Brain className="mr-2 h-5 w-5 text-primary" />
                Confidence Level Target
              </CardTitle>
              <CardDescription>Set your desired mastery level for topics (0-100%)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Target Confidence Level</Label>
                  <Badge variant="secondary" className="bg-primary/20 text-primary">
                    {formData.confidenceLevel[0]}%
                  </Badge>
                </div>
                <Slider
                  value={formData.confidenceLevel}
                  onValueChange={(value) => setFormData({...formData, confidenceLevel: value})}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Beginner (0%)</span>
                  <span>Intermediate (50%)</span>
                  <span>Expert (100%)</span>
                </div>
              </div>
              
              <div className="p-4 bg-primary/10 rounded-lg">
                <div className="flex items-center mb-2">
                  <Zap className="h-4 w-4 text-primary mr-2" />
                  <span className="font-medium text-sm">AI Recommendation</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Based on your selections, we recommend starting with {formData.confidenceLevel[0]}% confidence target. 
                  The AI will adapt the difficulty as you progress.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button 
              type="submit" 
              size="lg" 
              className="bg-gradient-primary hover:opacity-90 glow-primary px-12 py-4"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Create Classroom
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassroomCreation;