import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, ValidateNested } from 'class-validator';
import { AnswerOption } from '@prisma/client';

export class AnswerItemDto {
  @IsInt()
  questionId: number;

  @IsEnum(AnswerOption)
  answer: AnswerOption;
}

export class SubmitQuizDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers: AnswerItemDto[];
}
