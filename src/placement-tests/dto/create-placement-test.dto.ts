import { IsString, IsNotEmpty, IsArray, ValidateNested, IsInt, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class PlacementQuestionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  options: string[];

  @IsString()
  @IsNotEmpty()
  correctAnswer: string;
}

export class CreatePlacementTestDto {
  @IsInt()
  subjectId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlacementQuestionDto)
  @ArrayMinSize(1)
  questions: PlacementQuestionDto[];
}
