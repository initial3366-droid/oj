import { apiGet } from './client';

export interface Course {
  id: number;
  title: string;
  description: string;
  term: string;
  ownerAccountType: string;
  ownerId: number;
  teacherName: string;
  classIds: number[];
  classes: Array<{ id: number; name: string }>;
  classId: number | null;
  className: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  studentCount: number;
  practiceCount: number;
}
export interface CoursePractice {
  id: number;
  title: string;
  description: string;
  displayOrder: number;
  problemCount: number;
  solvedCount: number;
  hasPassword: boolean;
  startTime?: string | null;
  endTime?: string | null;
}
export interface CourseReport {
  courseId: number;
  practiceCount: number;
  students: Array<{ userId: number; displayName: string; studentNo: string; submissionCount: number; solvedCount: number; completedPractices: number; classId: number; className: string }>;
}
export interface CoursePage { total: number; list: Course[] }
export const fetchCourses = (page: number, keyword: string) => apiGet<CoursePage>(`/api/v1/courses?page=${page}&pageSize=12&keyword=${encodeURIComponent(keyword)}`, true);
export const fetchCourse = (id: number) => apiGet<Course>(`/api/v1/courses/${id}`, true);
export const fetchCoursePractices = (id: number) => apiGet<CoursePractice[]>(`/api/v1/courses/${id}/practices`, true);
