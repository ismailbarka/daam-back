import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { SubjectsModule } from './subjects/subjects.module';
import { LessonsModule } from './lessons/lessons.module';
import { QuizModule } from './quiz/quiz.module';
import { PlacementTestsModule } from './placement-tests/placement-tests.module';
import { ProgressModule } from './progress/progress.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    MailModule,
    SubjectsModule,
    LessonsModule,
    QuizModule,
    PlacementTestsModule,
    ProgressModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

