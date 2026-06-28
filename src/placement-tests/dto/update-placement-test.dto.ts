import { IsArray, ValidateNested, IsInt, ArrayMinSize, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PlacementQuestionDto } from './create-placement-test.dto';

export class UpdatePlacementTestDto {
  @IsInt()
  @IsOptional()
  subjectId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlacementQuestionDto)
  @ArrayMinSize(1)
  @IsOptional()
  questions?: PlacementQuestionDto[];
}
