import { IsString, IsNotEmpty, IsEnum, IsInt, IsOptional } from 'class-validator';
import { AnswerOption } from '@prisma/client';

export class UpdateQuestionDto {
  @IsInt()
  @IsOptional()
  lessonId?: number;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  question?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  optionA?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  optionB?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  optionC?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  optionD?: string;

  @IsEnum(AnswerOption)
  @IsOptional()
  correctAnswer?: AnswerOption;
}
