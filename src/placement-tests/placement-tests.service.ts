import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlacementTestDto } from './dto/create-placement-test.dto';
import { UpdatePlacementTestDto } from './dto/update-placement-test.dto';
import { SubmitPlacementTestDto } from './dto/submit-placement-test.dto';
import { SubmitAllPlacementTestsDto } from './dto/submit-all-placement-tests.dto';
import { Role, Level } from '@prisma/client';

@Injectable()
export class PlacementTestsService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreatePlacementTestDto) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: createDto.subjectId },
    });
    if (!subject) {
      throw new NotFoundException(`Subject with ID ${createDto.subjectId} not found`);
    }

    const existingTest = await this.prisma.placementTest.findUnique({
      where: { subjectId: createDto.subjectId },
    });
    if (existingTest) {
      throw new ConflictException(`Placement test already exists for Subject ID ${createDto.subjectId}`);
    }

    return this.prisma.placementTest.create({
      data: {
        subjectId: createDto.subjectId,
        questions: { create: createDto.questions },
      },
      include: { questions: true },
    });
  }

  async findAll(userRole: Role, studentId?: number) {
    await this.ensurePlacementIsAvailable(userRole, studentId);

    const tests = await this.prisma.placementTest.findMany({
      include: { questions: true, subject: true },
      orderBy: { id: 'asc' },
    });

    if (userRole === Role.STUDENT) {
      return tests.map((test) => this.sanitizeTest(test));
    }
    return tests;
  }

  async findOne(id: number, userRole: Role, studentId?: number) {
    await this.ensurePlacementIsAvailable(userRole, studentId);

    const test = await this.prisma.placementTest.findUnique({
      where: { id },
      include: { questions: true, subject: true },
    });
    if (!test) {
      throw new NotFoundException(`Placement test with ID ${id} not found`);
    }

    if (userRole === Role.STUDENT) {
      return this.sanitizeTest(test);
    }
    return test;
  }

  async findBySubjectId(subjectId: number, userRole: Role, studentId?: number) {
    await this.ensurePlacementIsAvailable(userRole, studentId);

    const test = await this.prisma.placementTest.findUnique({
      where: { subjectId },
      include: { questions: true, subject: true },
    });
    if (!test) {
      throw new NotFoundException(`Placement test for Subject ID ${subjectId} not found`);
    }

    if (userRole === Role.STUDENT) {
      return this.sanitizeTest(test);
    }
    return test;
  }

  async update(id: number, updateDto: UpdatePlacementTestDto) {
    const existing = await this.prisma.placementTest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Placement test with ID ${id} not found`);
    }

    if (updateDto.subjectId && updateDto.subjectId !== existing.subjectId) {
      const subject = await this.prisma.subject.findUnique({ where: { id: updateDto.subjectId } });
      if (!subject) {
        throw new NotFoundException(`Subject with ID ${updateDto.subjectId} not found`);
      }

      const otherTest = await this.prisma.placementTest.findUnique({
        where: { subjectId: updateDto.subjectId },
      });
      if (otherTest) {
        throw new ConflictException(`Placement test already exists for Subject ID ${updateDto.subjectId}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (updateDto.questions) {
        await tx.placementQuestion.deleteMany({ where: { placementTestId: id } });
      }

      return tx.placementTest.update({
        where: { id },
        data: {
          ...(updateDto.subjectId ? { subjectId: updateDto.subjectId } : {}),
          ...(updateDto.questions ? { questions: { create: updateDto.questions } } : {}),
        },
        include: { questions: true },
      });
    });
  }

  async remove(id: number) {
    const existing = await this.prisma.placementTest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Placement test with ID ${id} not found`);
    }

    return this.prisma.placementTest.delete({ where: { id } });
  }

  async submitAnswers(id: number, studentId: number, submitDto: SubmitPlacementTestDto) {
    const student = await this.prisma.user.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (student.placementTestCompleted) {
      throw new BadRequestException('You have already completed the placement test');
    }

    const test = await this.prisma.placementTest.findUnique({
      where: { id },
      include: { questions: true },
    });
    if (!test) {
      throw new NotFoundException(`Placement test with ID ${id} not found`);
    }

    if (test.questions.length === 0) {
      throw new BadRequestException('This placement test has no questions');
    }

    const existingResult = await this.prisma.placementTestResult.findUnique({
      where: { studentId_placementTestId: { studentId, placementTestId: id } },
    });
    if (existingResult) {
      throw new BadRequestException('You have already taken this placement test');
    }

    let correctCount = 0;
    const questionMap = new Map(test.questions.map((q) => [q.id, q]));

    for (const userAnswer of submitDto.answers) {
      const dbQuestion = questionMap.get(userAnswer.questionId);
      if (!dbQuestion) {
        throw new BadRequestException(`Question with ID ${userAnswer.questionId} does not belong to this test`);
      }
      if (dbQuestion.correctAnswer.trim().toLowerCase() === userAnswer.answer.trim().toLowerCase()) {
        correctCount++;
      }
    }

    const totalQuestions = test.questions.length;
    const score = (correctCount / totalQuestions) * 100;
    const level = this.calculateLevel(score);

    return this.prisma.placementTestResult.create({
      data: { placementTestId: id, studentId, score, level },
      include: { placementTest: { include: { subject: true } } },
    });
  }

  /**
   * Submit all placement tests in a single batch request.
   * Evaluates each, saves results, and marks placementTestCompleted = true.
   * Returns a map like: { mathLevel: 'Beginner', arabicLevel: 'Intermediate', placementTestCompleted: true }
   */
  async submitAll(studentId: number, dto: SubmitAllPlacementTestsDto) {
    const student = await this.prisma.user.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (student.placementTestCompleted) {
      throw new BadRequestException('You have already completed the placement test');
    }

    const placementTests = await this.prisma.placementTest.findMany({
      include: { questions: true, subject: true },
      orderBy: { id: 'asc' },
    });
    if (placementTests.length === 0) {
      throw new BadRequestException('No placement tests are available');
    }

    const submissionsByTestId = new Map<number, (typeof dto.submissions)[number]>();
    for (const submission of dto.submissions) {
      if (submissionsByTestId.has(submission.placementTestId)) {
        throw new BadRequestException(`Duplicate submission for placement test ${submission.placementTestId}`);
      }
      submissionsByTestId.set(submission.placementTestId, submission);
    }

    const missingTests = placementTests.filter((test) => !submissionsByTestId.has(test.id));
    if (missingTests.length > 0) {
      throw new BadRequestException('You must submit all placement tests');
    }

    const validTestIds = new Set(placementTests.map((test) => test.id));
    const unknownTestId = dto.submissions.find((submission) => !validTestIds.has(submission.placementTestId));
    if (unknownTestId) {
      throw new NotFoundException(`Placement test with ID ${unknownTestId.placementTestId} not found`);
    }

    const results: Array<{ subject: string; level: Level }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const test of placementTests) {
        const submission = submissionsByTestId.get(test.id);
        if (!submission) {
          throw new BadRequestException('You must submit all placement tests');
        }
        if (test.questions.length === 0) {
          throw new BadRequestException(`Placement test for ${test.subject.name} has no questions`);
        }

        let correct = 0;
        const questionMap = new Map(test.questions.map((q) => [q.id, q]));
        for (const ans of submission.answers) {
          const q = questionMap.get(ans.questionId);
          if (!q) {
            throw new BadRequestException(`Question with ID ${ans.questionId} does not belong to this test`);
          }
          if (q.correctAnswer.trim().toLowerCase() === ans.answer.trim().toLowerCase()) {
            correct++;
          }
        }

        const total = test.questions.length;
        const score = total > 0 ? (correct / total) * 100 : 0;
        const level = this.calculateLevel(score);

        await tx.placementTestResult.create({
          data: { placementTestId: test.id, studentId, score, level },
        });

        results.push({ subject: test.subject.name, level });
      }

      // Mark the student as having completed placement
      await tx.user.update({
        where: { id: studentId },
        data: { placementTestCompleted: true },
      });
    });

    const levelMap: Record<string, number> = {};
    for (const r of results) {
      levelMap[`${this.toLevelKey(r.subject)}Level`] = this.levelToNumber(r.level);
    }

    return { ...levelMap, placementTestCompleted: true };
  }

  async getMyResults(studentId: number) {
    return this.prisma.placementTestResult.findMany({
      where: { studentId },
      include: { placementTest: { include: { subject: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private calculateLevel(score: number): Level {
    if (score < 50) return Level.Beginner;
    if (score < 80) return Level.Intermediate;
    return Level.Advanced;
  }

  private async ensurePlacementIsAvailable(userRole: Role, studentId?: number) {
    if (userRole !== Role.STUDENT || studentId === undefined) return;

    const student = await this.prisma.user.findUnique({ where: { id: studentId } });
    if (student?.placementTestCompleted) {
      throw new BadRequestException('You have already completed the placement test');
    }
  }

  private levelToNumber(level: Level): number {
    if (level === Level.Beginner) return 1;
    if (level === Level.Intermediate) return 2;
    return 3;
  }

  private toLevelKey(subject: string): string {
    const words = subject
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean);

    return words
      .map((word, index) => {
        const normalized = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        return index === 0 ? normalized.charAt(0).toLowerCase() + normalized.slice(1) : normalized;
      })
      .join('');
  }

  private sanitizeTest(test: any) {
    if (!test || !test.questions) return test;
    return {
      ...test,
      questions: test.questions.map(({ correctAnswer, ...q }) => q),
    };
  }
}
