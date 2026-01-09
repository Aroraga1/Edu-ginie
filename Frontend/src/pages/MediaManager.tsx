import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft,
  Upload,
  FileText,
  Image,
  Video,
  Music,
  File,
  Search,
  Grid3X3,
  List,
  Download,
  Eye,
  Trash2,
  Plus,
  FolderOpen,
  Loader2,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { uploadPDF, getPDFs, deletePDF } from '@/lib/api';

const MediaManager = () => {
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [files, setFiles] = useState<Array<{
    id: string;
    filename: string;
    topic: string;
    subject: string;
    summary: string;
    timestamp: string | null;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTopic, setUploadTopic] = useState('');
  const [previewPdf, setPreviewPdf] = useState<{
    id: string;
    filename: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const response = await getPDFs();
      if (response?.pdfs) {
        setFiles(response.pdfs);
      }
    } catch (error: any) {
      console.error('Error loading files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      console.error("Invalid file type: PDF files only");
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadPDF(file, uploadTopic || undefined);
      if (response?.success) {
        setUploadTopic('');
        await loadFiles();
      } else {
        throw new Error(response?.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleFileSelect = (fileId: string, e?: React.MouseEvent) => {
    // If clicking on preview button, don't toggle selection
    if (e && (e.target as HTMLElement).closest('.preview-button')) {
      return;
    }
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handlePreview = (file: typeof files[0], e: React.MouseEvent) => {
    e.stopPropagation();
    const pdfUrl = `/ai_hub/get_pdf/${file.id}`;
    setPreviewPdf({
      id: file.id,
      filename: file.filename,
      url: pdfUrl
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedFiles.length} file(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      // Delete all selected files
      const deletePromises = selectedFiles.map(fileId => deletePDF(fileId));
      await Promise.all(deletePromises);

      setSelectedFiles([]);
      await loadFiles(); // Reload files list
    } catch (error: any) {
      console.error('Delete error:', error);
    }
  };

  const handleDeleteFile = async (fileId: string, filename: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${filename}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deletePDF(fileId);
      await loadFiles(); // Reload files list
    } catch (error: any) {
      console.error('Delete error:', error);
    }
  };

  const getFileType = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return 'image';
    if (['mp4', 'avi', 'mov'].includes(ext || '')) return 'video';
    if (['mp3', 'wav'].includes(ext || '')) return 'audio';
    return 'document';
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return FileText;
      case 'image':
        return Image;
      case 'video':
        return Video;
      case 'audio':
        return Music;
      default:
        return File;
    }
  };

  const filteredFiles = files.filter(file =>
    file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group files by category
  const categories = [
    { name: 'All Files', count: files.length, color: 'bg-primary' },
    { name: 'PDFs', count: files.filter(f => f.filename.toLowerCase().endsWith('.pdf')).length, color: 'bg-blue-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero p-6">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Link to="/dashboard">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/10 mr-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-gradient">Media Manager</h1>
              <p className="text-muted-foreground">Upload and manage your PDF learning materials</p>
            </div>
          </div>

          {/* Upload Section */}
          <div className="flex items-center gap-4">
            <Input
              placeholder="Topic (optional)"
              value={uploadTopic}
              onChange={(e) => setUploadTopic(e.target.value)}
              className="w-40 bg-background/50 border-border"
            />
            <div className="relative">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Button 
                className="bg-gradient-primary hover:opacity-90 glow-primary"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Categories */}
            <Card className="bg-gradient-card border-border glow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FolderOpen className="mr-2 h-5 w-5 text-primary" />
                  Categories
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between p-3 hover:bg-muted/30 rounded-lg transition-smooth cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                      <span className="text-sm">{category.name}</span>
                    </div>
                    <Badge variant="secondary" className="bg-primary/20 text-primary">
                      {category.count}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            {selectedFiles.length > 0 && (
              <Card className="bg-gradient-card border-border glow-card">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="destructive" 
                    className="w-full justify-start"
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Selected ({selectedFiles.length})
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Search and View Controls */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-input border-border focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Files Display */}
            <Card className="bg-gradient-card border-border glow-card">
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading files...</p>
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No files found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery ? 'Try adjusting your search terms' : 'Upload PDF files to get started'}
                    </p>
                    <div className="relative inline-block">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <Button className="bg-gradient-primary hover:opacity-90" disabled={isUploading}>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Your First PDF
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-2'}>
                    {filteredFiles.map((file) => {
                      const fileType = getFileType(file.filename);
                      const FileIcon = getFileIcon(fileType);
                      const isSelected = selectedFiles.includes(file.id);

                      if (viewMode === 'grid') {
                        return (
                          <div 
                            key={file.id}
                            className={`p-4 border rounded-lg transition-smooth ${
                              isSelected 
                                ? 'border-primary bg-primary/10 glow-feature' 
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={(e) => handleFileSelect(file.id, e)}
                          >
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="p-2 bg-primary/20 rounded-lg">
                                <FileIcon className="h-6 w-6 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">{file.filename}</h4>
                                <p className="text-xs text-muted-foreground">{file.subject || 'No subject'}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="secondary" className="bg-accent/20 text-accent text-xs">
                                {file.topic || 'General'}
                              </Badge>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="preview-button h-7 px-2"
                                  onClick={(e) => handlePreview(file, e)}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="delete-button h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => handleDeleteFile(file.id, file.filename, e)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            {file.summary && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                                {file.summary}
                              </p>
                            )}

                            {file.timestamp && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                {new Date(file.timestamp).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <div 
                            key={file.id}
                            className={`flex items-center space-x-4 p-3 border rounded-lg transition-smooth ${
                              isSelected 
                                ? 'border-primary bg-primary/10' 
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={(e) => handleFileSelect(file.id, e)}
                          >
                            <div className="p-2 bg-primary/20 rounded-lg">
                              <FileIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{file.filename}</h4>
                              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                <span>{file.subject || 'No subject'}</span>
                                {file.timestamp && (
                                  <>
                                    <span>•</span>
                                    <span>{new Date(file.timestamp).toLocaleDateString()}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-accent/20 text-accent">
                              {file.topic || 'General'}
                            </Badge>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="preview-button"
                                onClick={(e) => handlePreview(file, e)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="delete-button text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => handleDeleteFile(file.id, file.filename, e)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* PDF Preview Dialog */}
        <Dialog open={!!previewPdf} onOpenChange={() => setPreviewPdf(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>{previewPdf?.filename}</DialogTitle>
                  <DialogDescription>
                    Preview your uploaded document
                  </DialogDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewPdf(null)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              {previewPdf && (
                <iframe
                  src={previewPdf.url}
                  className="w-full h-[calc(90vh-120px)] border-0"
                  title={previewPdf.filename}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default MediaManager;
