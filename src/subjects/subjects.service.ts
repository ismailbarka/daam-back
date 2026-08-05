import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { Subject } from '@prisma/client';

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  async create(createSubjectDto: CreateSubjectDto): Promise<Subject> {
    return this.prisma.subject.create({
      data: {
        name: createSubjectDto.name,
        schoolLevel: createSubjectDto.schoolLevel ?? 1,
      },
    });
  }

  async findAll(studentId?: number, schoolLevelFilter?: number): Promise<Subject[]> {
    let whereClause: any = undefined;

    if (studentId !== undefined) {
      await this.ensurePlacementCompleted(studentId);
      const student = await this.prisma.user.findUnique({ where: { id: studentId } });
      if (student?.schoolLevel) {
        whereClause = { schoolLevel: student.schoolLevel };
      }
    } else if (schoolLevelFilter !== undefined) {
      whereClause = { schoolLevel: schoolLevelFilter };
    }

    return this.prisma.subject.findMany({
      where: whereClause,
      orderBy: [{ schoolLevel: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: number, studentId?: number): Promise<Subject> {
    await this.ensurePlacementCompleted(studentId);

    const subject = await this.prisma.subject.findUnique({
      where: { id },
    });
    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }
    return subject;
  }

  async update(id: number, updateSubjectDto: UpdateSubjectDto): Promise<Subject> {
    await this.findOne(id);
    return this.prisma.subject.update({
      where: { id },
      data: updateSubjectDto,
    });
  }

  async remove(id: number): Promise<Subject> {
    await this.findOne(id);
    return this.prisma.subject.delete({
      where: { id },
    });
  }

  private async ensurePlacementCompleted(studentId?: number) {
    if (studentId === undefined) return;

    const student = await this.prisma.user.findUnique({ where: { id: studentId } });
    if (!student?.placementTestCompleted) {
      throw new ForbiddenException('Complete the placement test first');
    }
  }
}
