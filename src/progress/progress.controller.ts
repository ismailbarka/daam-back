import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProgressService } from './progress.service';
import { IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class AccessibleLessonsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subjectId?: number;
}

@Controller('progress')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  /**
   * GET /progress/me
   * Returns all progress records (with lesson + subject info) for the authenticated student.
   */
  @Get('me')
  @Roles(Role.STUDENT, Role.ADMIN)
  async getMyProgress(@Request() req) {
    return this.progressService.getMyProgress(req.user.id);
  }

  /**
   * GET /progress/me/lessons?subjectId=1
   * Returns all lessons accessible to the authenticated student,
   * optionally filtered by subject. Includes inline progress for each lesson.
   */
  @Get('me/lessons')
  @Roles(Role.STUDENT, Role.ADMIN)
  async getAccessibleLessons(
    @Request() req,
    @Query() query: AccessibleLessonsQueryDto,
  ) {
    return this.progressService.getAccessibleLessons(req.user.id, query.subjectId);
  }
}
