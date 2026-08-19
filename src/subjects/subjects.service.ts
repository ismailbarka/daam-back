import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { Subject as PrismaSubject } from '@prisma/client';

export type SubjectWithProgress = PrismaSubject & {
  progress: number;
};

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  async create(createSubjectDto: CreateSubjectDto): Promise<PrismaSubject> {
    return this.prisma.subject.create({
      data: {
        name: createSubjectDto.name,
        schoolLevel: createSubjectDto.schoolLevel ?? 1,
      },
    });
  }

  private calculateProgress(completedLessons: number, totalLessons: number) {
    if (totalLessons <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((completedLessons / totalLessons) * 100)));
  }

  private countCompletedLessons(lessons: Array<{ progress?: Array<{ completed: boolean }> }>) {
    return lessons.filter((lesson) => lesson.progress?.[0]?.completed === true).length;
  }

  async findAll(studentId?: number, schoolLevelFilter?: number): Promise<SubjectWithProgress[]> {
    let whereClause: any = undefined;

    if (studentId !== undefined) {
      const student = await this.prisma.user.findUnique({ where: { id: studentId } });
      if (student?.schoolLevel) {
        whereClause = { schoolLevel: student.schoolLevel };
      }
    } else if (schoolLevelFilter !== undefined) {
      whereClause = { schoolLevel: schoolLevelFilter };
    }

    const subjects = await this.prisma.subject.findMany({
      where: whereClause,
      include: studentId
        ? {
            lessons: {
              include: {
                progress: {
                  where: { studentId },
                },
              },
              orderBy: { order: 'asc' },
            },
          }
        : {
            lessons: {
              select: { id: true },
            },
          },
      orderBy: [{ schoolLevel: 'asc' }, { name: 'asc' }],
    });

    return subjects.map((subject) => {
      const totalLessons = subject.lessons.length;
      const completedLessons = studentId ? this.countCompletedLessons(subject.lessons as any) : 0;

      return {
        ...subject,
        progress: this.calculateProgress(completedLessons, totalLessons),
      };
    });
  }

  async findOne(id: number, studentId?: number): Promise<SubjectWithProgress> {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: studentId
        ? {
            lessons: {
              include: {
                progress: {
                  where: { studentId },
                },
              },
              orderBy: { order: 'asc' },
            },
          }
        : {
            lessons: {
              select: { id: true },
            },
          },
    });
    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    const totalLessons = subject.lessons.length;
    const completedLessons = studentId ? this.countCompletedLessons(subject.lessons as any) : 0;

    return {
      ...subject,
      progress: this.calculateProgress(completedLessons, totalLessons),
    };
  }

  async update(id: number, updateSubjectDto: UpdateSubjectDto): Promise<PrismaSubject> {
    await this.findOne(id);
    try {
      return await this.prisma.subject.update({
        where: { id },
        data: updateSubjectDto,
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002') {
        throw new BadRequestException('A subject with this name already exists for this school level');
      }
      throw error;
    }
  }

  async remove(id: number): Promise<PrismaSubject> {
    await this.findOne(id);
    return this.prisma.subject.delete({
      where: { id },
    });
  }
}
