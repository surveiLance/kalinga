export type GradeLevel = string;

export type LearnerSex = "Female" | "Male" | "Not specified";

export type ClassLearner = {
  id: string;
  name: string;
  grade: GradeLevel;
  sex: LearnerSex;
};

export type ClassMeeting = {
  id: string;
  days: string;
  startTime: string;
  durationMinutes: number;
  label: string;
};

export type TodayTeachingBlock = {
  classId: string;
  className: string;
  grades: GradeLevel[];
  meeting: ClassMeeting;
};

export type TeachingClass = {
  id: string;
  name: string;
  grades: GradeLevel[];
  subjects: string[];
  quarter: string;
  meetingDays: string;
  startTime: string;
  meetings: ClassMeeting[];
  learners: ClassLearner[];
};

export type LegacyTeachingClass = Omit<Partial<TeachingClass>, "grades" | "learners" | "meetings"> & {
  id: string;
  name: string;
  grades?: Array<GradeLevel | number>;
  learners?: Array<Omit<ClassLearner, "grade" | "sex"> & { grade: GradeLevel | number; sex?: LearnerSex | string }>;
  meetings?: Array<Partial<ClassMeeting>>;
  subject?: string;
  learnerCount?: number;
};

export type PlanSlot = {
  id: string;
  time: string;
  teacherFocus: string;
  gradeTasks: Record<GradeLevel, string>;
};

export type SavedPlan = {
  id: string;
  classId: string;
  title: string;
  subject: string;
  quarter: string;
  grades: GradeLevel[];
  duration: string;
  startTime?: string;
  language?: string;
  competencies?: Record<GradeLevel, string>;
  sharedTheme?: string;
  multigradeModel?: string;
  objectives?: Record<GradeLevel, string>;
  learnerContext?: string;
  materials?: string;
  formativeAssessments?: Record<GradeLevel, string>;
  exitTasks?: Record<GradeLevel, string>;
  successCriteria?: Record<GradeLevel, string>;
  reflection?: string;
  remediation?: string;
  enrichment?: string;
  nextSessionNotes?: string;
  slots: PlanSlot[];
  savedAt: string;
};

export type LegacySavedPlan = Omit<SavedPlan, "grades"> & { grades: Array<GradeLevel | number> };

export type TeacherWorkspace = {
  classes: TeachingClass[];
  plans: SavedPlan[];
  savedResourceIds: string[];
  attendance: Record<string, Record<string, string>>;
  attendanceNotes: Record<string, Record<string, string>>;
};
