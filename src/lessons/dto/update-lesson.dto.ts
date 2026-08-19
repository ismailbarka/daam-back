import { IsString, IsNotEmpty, IsOptional, IsUrl, IsInt, Min, Max } from 'class-validator';

export class UpdateLessonDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl()
  @IsOptional()
  youtubeUrl?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  order?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  passingScore?: number;

  @IsInt()
  @IsOptional()
  subjectId?: number;
}
