import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { Lesson } from '@prisma/client';

export type LessonStatus = 'completed' | 'unlocked' | 'locked';

export interface LessonWithStatus extends Lesson {
  status: LessonStatus;
  quiz: any[];
}

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  async create(createLessonDto: CreateLessonDto): Promise<Lesson> {
    const { subjectId, ...lessonData } = createLessonDto;

    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      throw new NotFoundException(`Subject with ID ${subjectId} not found`);
    }

    return this.prisma.lesson.create({
      data: { ...lessonData, passingScore: lessonData.passingScore ?? 70, subjectId },
    });
  }

  /**
   * Returns all lessons for a subject.
   * When studentId is provided, each lesson includes a `status` field:
   *   - 'completed'  → student passed this lesson
   *   - 'unlocked'   → student can attempt this lesson
   *   - 'locked'     → student has not yet unlocked this lesson
   * Quiz questions are included but correctAnswer is stripped for students.
   */
  async findAll(subjectId?: number, studentId?: number): Promise<LessonWithStatus[]> {
    await this.ensurePlacementCompleted(studentId);

    let whereClause: any = subjectId !== undefined ? { subjectId } : undefined;
    if (studentId !== undefined) {
      const student = await this.prisma.user.findUnique({ where: { id: studentId } });
      if (student?.schoolLevel) {
        whereClause = {
          ...whereClause,
          subject: { schoolLevel: student.schoolLevel },
        };
      }
    }

    const lessons = await this.prisma.lesson.findMany({
      where: whereClause,
      orderBy: { order: 'asc' },
      include: {
        questions: {
          select: {
            id: true,
            question: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            lessonId: true,
            createdAt: true,
            updatedAt: true,
            // correctAnswer intentionally excluded for students
          },
        },
        progress: studentId !== undefined ? { where: { studentId } } : false,
      },
    });

    if (studentId === undefined) {
      // Admin view — include correct answers
      const adminLessons = await this.prisma.lesson.findMany({
        where: subjectId !== undefined ? { subjectId } : undefined,
        orderBy: [{ subjectId: 'asc' }, { order: 'asc' }],
        include: { subject: true, questions: { orderBy: { id: 'asc' } } },
      });
      return adminLessons.map((l) => ({ ...l, status: 'unlocked' as LessonStatus, quiz: (l as any).questions }));
    }

    // Student view — compute status for each lesson
    const result: LessonWithStatus[] = [];
    let previousCompleted = true; // first lesson is always accessible

    for (const lesson of lessons) {
      const progressRecords = (lesson as any).progress as any[];
      const myProgress = progressRecords?.[0] ?? null;
      const isCompleted = myProgress?.completed === true;

      let status: LessonStatus;
      if (isCompleted) {
        status = 'completed';
      } else if (previousCompleted) {
        status = 'unlocked';
      } else {
        status = 'locked';
      }

      const { progress, questions, ...lessonData } = lesson as any;

      result.push({
        ...lessonData,
        status,
        quiz: questions, // correctAnswer already excluded by the select above
      });

      previousCompleted = isCompleted;
    }

    return result;
  }

  /**
   * Returns a single lesson. For students, throws 403 if locked.
   */
  async findOne(id: number, studentId?: number): Promise<Lesson> {
    await this.ensurePlacementCompleted(studentId);

    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    if (studentId !== undefined) {
      // Check accessibility via the same ordered-lesson logic
      const subject = await this.prisma.subject.findUnique({
        where: { id: lesson.subjectId },
        include: { lessons: { orderBy: { order: 'asc' } } },
      });

      const orderedLessons = subject!.lessons;
      const firstLesson = orderedLessons[0];

      if (lesson.id !== firstLesson.id) {
        const currentIndex = orderedLessons.findIndex((l) => l.id === id);
        if (currentIndex > 0) {
          const previousLesson = orderedLessons[currentIndex - 1];
          const progress = await this.prisma.progress.findUnique({
            where: { studentId_lessonId: { studentId, lessonId: previousLesson.id } },
          });
          if (!progress?.completed) {
            throw new ForbiddenException('This lesson is locked. Complete the previous lesson first.');
          }
        }
      }
    }

    return lesson;
  }

  async update(id: number, updateLessonDto: UpdateLessonDto): Promise<Lesson> {
    await this.findOne(id);

    const { subjectId, ...lessonData } = updateLessonDto;

    if (subjectId !== undefined) {
      const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
      if (!subject) {
        throw new NotFoundException(`Subject with ID ${subjectId} not found`);
      }
    }

    return this.prisma.lesson.update({
      where: { id },
      data: { ...lessonData, ...(subjectId !== undefined ? { subjectId } : {}) },
    });
  }

  async remove(id: number): Promise<Lesson> {
    await this.findOne(id);
    return this.prisma.lesson.delete({ where: { id } });
  }

  private async ensurePlacementCompleted(studentId?: number) {
    if (studentId === undefined) return;

    const student = await this.prisma.user.findUnique({ where: { id: studentId } });
    if (!student?.placementTestCompleted) {
      throw new ForbiddenException('Complete the placement test first');
    }
  }
}
