import { IsString, IsNotEmpty, MinLength, IsInt, Min, Max } from 'class-validator';

export class CompleteProfileDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username: string;

  @IsInt()
  @Min(1)
  @Max(6)
  schoolLevel: number;
}
