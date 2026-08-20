import { IsInt, Min, Max } from 'class-validator';

export class UpdateLevelDto {
  @IsInt()
  @Min(1)
  @Max(6)
  schoolLevel: number;
}
