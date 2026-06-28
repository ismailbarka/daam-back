import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  /**
   * Upsert a progress record after a quiz attempt.
   * Only marks completed=true when the score meets or exceeds the lesson's passingScore.
   */
  async record(studentId: number, lessonId: number, score: number, passed: boolean) {
    const now = passed ? new Date() : null;

    return this.prisma.progress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      update: {
        score,
        ...(passed ? { completed: true, completedAt: now } : {}),
      },
      create: {
        studentId,
        lessonId,
        score,
        completed: passed,
        completedAt: now,
      },
    });
  }

  /**
   * Determines whether a student can access a lesson.
   *
   * Rules:
   *  - Admins bypass this check entirely (handled in controller).
   *  - The lesson with the lowest `order` in its subject is always accessible.
   *  - Any subsequent lesson is accessible only if the lesson immediately
   *    before it (same subject, order - 1) is completed by the student.
   */
  async isLessonAccessible(studentId: number, lessonId: number): Promise<boolean> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { subject: { include: { lessons: { orderBy: { order: 'asc' } } } } },
    });

    if (!lesson) return false;

    const orderedLessons = lesson.subject.lessons;
    const firstLesson = orderedLessons[0];

    // First lesson is always accessible
    if (lesson.id === firstLesson.id) return true;

    // Find the lesson that immediately precedes this one
    const currentIndex = orderedLessons.findIndex((l) => l.id === lessonId);
    if (currentIndex <= 0) return false;

    const previousLesson = orderedLessons[currentIndex - 1];

    const progress = await this.prisma.progress.findUnique({
      where: {
        studentId_lessonId: { studentId, lessonId: previousLesson.id },
      },
    });

    return progress?.completed === true;
  }

  /**
   * Returns all lessons accessible to a student (optionally filtered by subjectId).
   * First lesson is always included; subsequent lessons only if previous is completed.
   */
  async getAccessibleLessons(studentId: number, subjectId?: number) {
    const subjects = await this.prisma.subject.findMany({
      where: subjectId ? { id: subjectId } : undefined,
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          include: {
            progress: {
              where: { studentId },
            },
          },
        },
      },
    });

    const accessible: any[] = [];

    for (const subject of subjects) {
      let previousCompleted = true; // first lesson needs no prerequisite

      for (const lesson of subject.lessons) {
        if (!previousCompleted) break;

        const { progress, ...lessonData } = lesson;
        const myProgress = progress[0] ?? null;

        accessible.push({
          ...lessonData,
          subjectName: subject.name,
          progress: myProgress
            ? {
                score: myProgress.score,
                completed: myProgress.completed,
                completedAt: myProgress.completedAt,
              }
            : null,
        });

        // Next lesson is only accessible if this one is completed
        previousCompleted = myProgress?.completed === true;
      }
    }

    return accessible;
  }

  /**
   * Returns all Progress records for a student, including lesson and subject info.
   */
  async getMyProgress(studentId: number) {
    return this.prisma.progress.findMany({
      where: { studentId },
      include: {
        lesson: {
          include: { subject: { select: { id: true, name: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
