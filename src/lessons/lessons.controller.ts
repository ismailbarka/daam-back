import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, ParseIntPipe } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { GetLessonsQueryDto } from './dto/get-lessons-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() createLessonDto: CreateLessonDto) {
    return this.lessonsService.create(createLessonDto);
  }

  /**
   * GET /lessons?subjectId=1
   * Students receive all lessons with a `status` field (completed/unlocked/locked).
   * Admins receive all lessons without status enforcement.
   */
  @Get()
  @Roles(Role.ADMIN, Role.STUDENT)
  async findAll(@Query() query: GetLessonsQueryDto, @Request() req) {
    const studentId = req.user.role === Role.STUDENT ? req.user.id : undefined;
    return this.lessonsService.findAll(query.subjectId, studentId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STUDENT)
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const studentId = req.user.role === Role.STUDENT ? req.user.id : undefined;
    return this.lessonsService.findOne(id, studentId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateLessonDto: UpdateLessonDto) {
    return this.lessonsService.update(id, updateLessonDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.remove(id);
  }
}
