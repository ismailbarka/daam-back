import { IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class GetLessonsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subjectId?: number;
}
