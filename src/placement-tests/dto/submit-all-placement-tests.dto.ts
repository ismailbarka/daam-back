import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, ValidateNested, ArrayMinSize } from 'class-validator';

class PlacementAnswerDto {
  @IsInt()
  questionId: number;

  @IsString()
  answer: string;
}

class SingleTestSubmissionDto {
  @IsInt()
  placementTestId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlacementAnswerDto)
  answers: PlacementAnswerDto[];
}

export class SubmitAllPlacementTestsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SingleTestSubmissionDto)
  submissions: SingleTestSubmissionDto[];
}
