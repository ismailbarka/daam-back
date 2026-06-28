import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateQuestionDto } from './dto/create-question.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuizService } from './quiz.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  // ─── Lesson-scoped quiz routes ─────────────────────────────────────────

  @Get('lessons/:lessonId/quiz')
  @Roles(Role.ADMIN, Role.STUDENT)
  async getQuiz(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Request() req,
  ) {
    // Admins see the correct answers; students do not
    const includeAnswers = req.user.role === Role.ADMIN;
    const studentId = req.user.role === Role.STUDENT ? req.user.id : undefined;
    return this.quizService.getQuiz(lessonId, includeAnswers, studentId);
  }

  @Post('lessons/:lessonId/quiz/submit')
  @Roles(Role.ADMIN, Role.STUDENT)
  async submitQuiz(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Body() submitQuizDto: SubmitQuizDto,
    @Request() req,
  ) {
    const studentId = req.user.role === Role.STUDENT ? req.user.id : undefined;
    return this.quizService.submitQuiz(lessonId, submitQuizDto, studentId);
  }

  // ─── Admin question management ─────────────────────────────────────────

  @Post('quiz/questions')
  @Roles(Role.ADMIN)
  async addQuestion(@Body() createQuestionDto: CreateQuestionDto) {
    return this.quizService.addQuestion(createQuestionDto);
  }

  @Patch('quiz/questions/:id')
  @Roles(Role.ADMIN)
  async updateQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ) {
    return this.quizService.updateQuestion(id, updateQuestionDto);
  }

  @Delete('quiz/questions/:id')
  @Roles(Role.ADMIN)
  async removeQuestion(@Param('id', ParseIntPipe) id: number) {
    return this.quizService.removeQuestion(id);
  }
}
