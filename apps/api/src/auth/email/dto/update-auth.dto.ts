import { PartialType } from '@nestjs/mapped-types';
import { SignUpDto } from './signup.dto.js';

export class UpdateAuthDto extends PartialType(SignUpDto) { }
