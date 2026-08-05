import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Request, Query } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() createSubjectDto: CreateSubjectDto) {
    return this.subjectsService.create(createSubjectDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STUDENT)
  async findAll(@Request() req, @Query('schoolLevel') schoolLevelQuery?: string) {
    const studentId = req.user.role === Role.STUDENT ? req.user.id : undefined;
    const schoolLevel = schoolLevelQuery ? parseInt(schoolLevelQuery, 10) : undefined;
    return this.subjectsService.findAll(studentId, schoolLevel);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STUDENT)
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const studentId = req.user.role === Role.STUDENT ? req.user.id : undefined;
    return this.subjectsService.findOne(id, studentId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateSubjectDto: UpdateSubjectDto) {
    return this.subjectsService.update(id, updateSubjectDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.subjectsService.remove(id);
  }
}
