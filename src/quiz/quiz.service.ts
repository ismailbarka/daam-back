import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

export interface QuizResult {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  progress?: {
    lessonId: number;
    completed: boolean;
    score: number;
  };
}

@Injectable()
export class QuizService {
  constructor(private prisma: PrismaService) {}

  // ─── Admin: Question CRUD ────────────────────────────────────────────────

  async addQuestion(dto: CreateQuestionDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: dto.lessonId },
    });
    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${dto.lessonId} not found`);
    }

    return this.prisma.quizQuestion.create({ data: dto });
  }

  async updateQuestion(id: number, dto: UpdateQuestionDto) {
    await this.ensureQuestionExists(id);
    return this.prisma.quizQuestion.update({ where: { id }, data: dto });
  }

  async removeQuestion(id: number) {
    await this.ensureQuestionExists(id);
    return this.prisma.quizQuestion.delete({ where: { id } });
  }

  // ─── Student & Admin: Get Quiz (strips correctAnswer for non-admin use) ──

  async getQuiz(lessonId: number, includeAnswers = false, studentId?: number) {
    await this.ensureLessonExists(lessonId);
    if (studentId !== undefined) {
      await this.ensurePlacementCompleted(studentId);
      await this.ensureLessonIsAccessible(studentId, lessonId);
    }

    const questions = await this.prisma.quizQuestion.findMany({
      where: { lessonId },
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
        // Only include correctAnswer when explicitly requested (admin view)
        correctAnswer: includeAnswers,
      },
    });

    return questions;
  }

  // ─── Student & Admin: Submit quiz and calculate score ───────────────────

  async submitQuiz(lessonId: number, dto: SubmitQuizDto, studentId?: number): Promise<QuizResult> {
    const lesson = await this.ensureLessonExists(lessonId);
    if (studentId !== undefined) {
      await this.ensurePlacementCompleted(studentId);
      await this.ensureLessonIsAccessible(studentId, lessonId);
    }

    if (dto.answers.length === 0) {
      const result = { score: 0, passed: false, correct: 0, total: 0 };
      if (studentId === undefined) return result;
      const progress = await this.saveProgress(studentId, lessonId, 0, false);
      return { ...result, progress };
    }

    // Fetch only the questions that belong to this lesson
    const questionIds = dto.answers.map((a) => a.questionId);
    const questions = await this.prisma.quizQuestion.findMany({
      where: { id: { in: questionIds }, lessonId },
      select: { id: true, correctAnswer: true },
    });

    const total = questions.length;
    let correct = 0;

    for (const q of questions) {
      const studentAnswer = dto.answers.find((a) => a.questionId === q.id);
      if (studentAnswer && studentAnswer.answer === q.correctAnswer) {
        correct++;
      }
    }

    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= 70;

    if (studentId === undefined) {
      return { score, passed, correct, total };
    }

    const progress = await this.saveProgress(studentId, lesson.id, score, passed);
    return { score, passed, correct, total, progress };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async ensureLessonExists(lessonId: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }
    return lesson;
  }

  private async ensureQuestionExists(id: number) {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id },
    });
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    return question;
  }

  private async ensurePlacementCompleted(studentId: number) {
    const student = await this.prisma.user.findUnique({ where: { id: studentId } });
    if (!student?.placementTestCompleted) {
      throw new ForbiddenException('Complete the placement test first');
    }
  }

  private async ensureLessonIsAccessible(studentId: number, lessonId: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { subject: { include: { lessons: { orderBy: { order: 'asc' } } } } },
    });
    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    const orderedLessons = lesson.subject.lessons;
    const currentIndex = orderedLessons.findIndex((item) => item.id === lessonId);
    if (currentIndex <= 0) return;

    const previousLesson = orderedLessons[currentIndex - 1];
    const previousProgress = await this.prisma.progress.findUnique({
      where: { studentId_lessonId: { studentId, lessonId: previousLesson.id } },
    });

    if (!previousProgress?.completed) {
      throw new ForbiddenException('This lesson is locked. Complete the previous lesson first.');
    }
  }

  private async saveProgress(studentId: number, lessonId: number, score: number, passed: boolean) {
    const existing = await this.prisma.progress.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });

    const nextScore = Math.max(score, existing?.score ?? 0);
    const completed = existing?.completed || passed;
    const completedAt = completed ? (existing?.completedAt ?? new Date()) : null;

    const progress = await this.prisma.progress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      update: {
        score: nextScore,
        completed,
        completedAt,
      },
      create: {
        studentId,
        lessonId,
        score,
        completed: passed,
        completedAt: passed ? new Date() : null,
      },
    });

    return {
      lessonId: progress.lessonId,
      completed: progress.completed,
      score: progress.score,
    };
  }
}
