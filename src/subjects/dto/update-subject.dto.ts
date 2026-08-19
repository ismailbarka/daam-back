import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateSubjectDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsInt()
  @Min(1)
  @Max(6)
  @IsOptional()
  schoolLevel?: number;
}
