/**
 * Artifact types
 */

/**
 * Artifact type enum
 */
export enum ArtifactType {
  UNKNOWN = 0,
  DOCUMENT = 1,
  PRESENTATION = 2,
  OUTLINE = 3,
  STUDY_GUIDE = 4,
  QUIZ = 5,
  FLASHCARDS = 6,
  MIND_MAP = 7,
  INFOGRAPHIC = 8,
  SLIDE_DECK = 9,
}

/**
 * Artifact state enum
 */
export enum ArtifactState {
  UNKNOWN = 0,
  CREATING = 1,
  READY = 2,
  FAILED = 3,
}

/**
 * Artifact
 */
export interface Artifact {
  /** Artifact ID */
  artifactId: string;
  
  /** Artifact type */
  type?: ArtifactType;
  
  /** Artifact state */
  state?: ArtifactState;
  
  /** Artifact title */
  title?: string;
  
  /** Source IDs used */
  sourceIds?: string[];
  
  /** Creation timestamp */
  createdAt?: string;
  
  /** Last modified timestamp */
  updatedAt?: string;
}

/**
 * Options for creating artifacts
 */
export interface CreateArtifactOptions {
  /** Artifact title */
  title?: string;
  
  /** Custom instructions */
  instructions?: string;
  
  /** Source IDs to use (optional, uses all sources if not specified) */
  sourceIds?: string[];
  
  /** Additional customization options */
  customization?: {
    /** Language (for multi-language support) */
    language?: string;
    
    /** Tone/style */
    tone?: 'professional' | 'casual' | 'academic' | 'friendly';
    
    /** Length preference */
    length?: 'short' | 'medium' | 'long';
    
    /** Focus areas */
    focusAreas?: string[];
  };
}

