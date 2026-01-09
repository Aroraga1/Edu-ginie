import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Brain, MessageSquare, Trophy, Zap, Users, BookOpen, Target, Star } from 'lucide-react';
import heroImage from '@/assets/hero-bg.jpg';

const HomePage = () => {
  const features = [
    {
      icon: Brain,
      title: "MainConcept Explainer",
      description: "AI breaks down complex topics into digestible concepts with visual aids and real-world examples."
    },
    {
      icon: MessageSquare,
      title: "Voice Conversational",
      description: "Natural voice interactions with your AI tutor for immersive learning experiences."
    },
    {
      icon: Trophy,
      title: "Gamification System",
      description: "Earn badges, maintain streaks, and unlock achievements as you progress through your learning journey."
    },
    {
      icon: Zap,
      title: "AI-Powered Personalization",
      description: "Adaptive learning paths that adjust to your pace, learning style, and knowledge gaps."
    }
  ];

  const services = [
    {
      title: "Personalized Tutoring",
      description: "One-on-one AI tutoring sessions tailored to your learning needs and goals.",
      gradient: "bg-gradient-primary"
    },
    {
      title: "Content Generation",
      description: "Automatically generate presentations, flowcharts, and study materials from any topic.",
      gradient: "bg-gradient-secondary"
    },
    {
      title: "Smart Assessments",
      description: "Create and take adaptive exams that identify knowledge gaps and suggest improvements.",
      gradient: "bg-gradient-primary"
    }
  ];

  const outcomes = [
    { icon: Users, title: "For Students", description: "Accelerated learning with personalized AI guidance" },
    { icon: BookOpen, title: "For Educators", description: "Enhanced teaching tools and student progress insights" },
    { icon: Target, title: "For Institutions", description: "Improved learning outcomes and engagement metrics" }
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-gradient">Edu Ginie</div>
          <div className="hidden md:flex space-x-8">
            <a href="#features" className="text-muted-foreground hover:text-primary transition-smooth">Features</a>
            <a href="#services" className="text-muted-foreground hover:text-primary transition-smooth">Services</a>
            <a href="#outcomes" className="text-muted-foreground hover:text-primary transition-smooth">Outcomes</a>
          </div>
          <div className="flex space-x-3">
            <Link to="/login">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                Login
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="default" className="bg-gradient-primary hover:opacity-90 glow-feature">
                Sign Up <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-6xl md:text-8xl font-bold mb-8 animate-slide-up">
              <span className="text-gradient">AI-Powered</span><br />
              <span className="text-foreground">Education Revolution</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto animate-slide-up">
              Transform your learning experience with personalized AI tutoring, adaptive assessments, and gamified progress tracking.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up">
              <Link to="/register">
                <Button size="lg" className="bg-gradient-primary hover:opacity-90 glow-primary text-lg px-8 py-4">
                  Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary/10 text-lg px-8 py-4">
                  Login to Continue
                </Button>
              </Link>
            </div>
          </div>
          <div className="mt-20 relative">
            <img 
              src={heroImage} 
              alt="AI Education Platform" 
              className="rounded-2xl glow-card max-w-4xl mx-auto animate-float"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">Powerful Features</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience the future of education with cutting-edge AI technology
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-gradient-card border-border hover:glow-feature transition-smooth group">
                <CardHeader>
                  <feature.icon className="h-12 w-12 text-primary mb-4 group-hover:animate-pulse-glow" />
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Core Services</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Comprehensive learning solutions powered by advanced AI
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <Card key={index} className="bg-gradient-card border-border glow-card group hover:scale-105 transition-bounce">
                <CardHeader>
                  <div className={`h-16 w-16 rounded-lg ${service.gradient} flex items-center justify-center mb-4 group-hover:animate-pulse-glow`}>
                    <Star className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl">{service.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-muted-foreground text-lg">
                    {service.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Outcomes Section */}
      <section id="outcomes" className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">Transform Learning Outcomes</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Measurable impact across all educational stakeholders
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {outcomes.map((outcome, index) => (
              <div key={index} className="text-center group">
                <div className="bg-gradient-primary rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-6 group-hover:animate-pulse-glow glow-feature">
                  <outcome.icon className="h-10 w-10 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{outcome.title}</h3>
                <p className="text-muted-foreground text-lg">{outcome.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-primary">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 text-primary-foreground">
            Ready to Transform Your Learning?
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-12 max-w-2xl mx-auto">
            Join thousands of learners already experiencing the future of education with Edu Ginie.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-4 hover:scale-105 transition-bounce">
                Start Learning Now <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-lg px-8 py-4">
                Already a Member?
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-card border-t border-border">
        <div className="container mx-auto px-6 text-center">
          <div className="text-2xl font-bold text-gradient mb-4">Edu Ginie</div>
          <p className="text-muted-foreground">
            Empowering education through artificial intelligence
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;