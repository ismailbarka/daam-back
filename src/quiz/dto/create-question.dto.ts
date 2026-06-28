import { IsString, IsNotEmpty, IsEnum, IsInt } from 'class-validator';
import { AnswerOption } from '@prisma/client';

export class CreateQuestionDto {
  @IsInt()
  lessonId: number;

  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsNotEmpty()
  optionA: string;

  @IsString()
  @IsNotEmpty()
  optionB: string;

  @IsString()
  @IsNotEmpty()
  optionC: string;

  @IsString()
  @IsNotEmpty()
  optionD: string;

  @IsEnum(AnswerOption)
  correctAnswer: AnswerOption;
}
