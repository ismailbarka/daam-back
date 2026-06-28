import { IsString, IsNotEmpty, IsArray, ValidateNested, IsInt, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class UserAnswerDto {
  @IsInt()
  questionId: number;

  @IsString()
  @IsNotEmpty()
  answer: string;
}

export class SubmitPlacementTestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserAnswerDto)
  @ArrayMinSize(1)
  answers: UserAnswerDto[];
}
