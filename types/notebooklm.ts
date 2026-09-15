/**
 * Type definitions for NotebookLM artifacts and related data.
 * Used to ensure type safety when processing clinical data from NotebookLM.
 */

export type ArtifactTypeId =
  | 'audio'
  | 'report'
  | 'video'
  | 'quiz'
  | 'mind_map'
  | 'infographic'
  | 'slide_deck'
  | 'data_table'
  | `type_${number}`;

export interface Artifact {
  id: string;
  title: string;
  type_id: ArtifactTypeId;
  type: ArtifactTypeId;
  status: 'in_progress' | 'completed' | 'error' | 'pending';
  status_id: number;
  artifactUrl?: string | null;
  url?: string | null;
  download_url?: string | null;
  pptx_url?: string | null;
  content?: unknown;
  slides?: Slide[];
  quizQuestions?: QuizQuestion[];
  flashcards?: Flashcard[];
  mindmapNodes?: MindmapNode[];
  raw?: unknown[];
}

export interface Slide {
  content: string;
  title?: string;
  notes?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answers?: string[];
  choices?: string[];
  text?: string;
  prompt?: string;
}

export interface Flashcard {
  front: string;
  back: string;
  frontText?: string;
  backText?: string;
}

export interface MindmapNode {
  label: string;
  text?: string;
  title?: string;
  name?: string;
  depth?: number;
  level?: number;
}

export interface NotebookInfo {
  id: string;
  title: string;
  index?: number;
  is_owner?: boolean;
  created_at?: string;
}

export interface ArtifactDetail {
  artifact: Artifact;
  artifactUrl?: string | null;
  type?: ArtifactTypeId;
  type_id?: ArtifactTypeId;
  title?: string;
  content?: unknown;
  slides?: Slide[];
  quizQuestions?: QuizQuestion[];
  flashcards?: Flashcard[];
  mindmapNodes?: MindmapNode[];
}

export interface ArtifactPreviewProps {
  artifact: Artifact;
  detail: ArtifactDetail | null;
  onDownload: () => void;
  onShare: () => void;
  onExport: () => void;
}

export interface PdfViewerProps {
  url: string;
  directUrl?: string | null;
  title: string;
}

export interface AudioPreviewProps {
  artifact: Artifact;
  detail: ArtifactDetail | null;
  onDownload: () => void;
  onExport: () => void;
}

export interface VideoPreviewProps {
  artifact: Artifact;
  detail: ArtifactDetail | null;
  onDownload: () => void;
  onExport: () => void;
}

export interface ImagePreviewProps {
  artifact: Artifact;
  detail: ArtifactDetail | null;
  onDownload: () => void;
  onExport: () => void;
}
