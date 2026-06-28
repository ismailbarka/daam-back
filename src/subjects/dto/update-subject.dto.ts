import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateSubjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
