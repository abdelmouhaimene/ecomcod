import { Injectable } from '@nestjs/common';
import { SignUpDto } from './dto/signup.dto.js';
import { UpdateAuthDto } from './dto/update-auth.dto.js';

@Injectable()
export class AuthService {
  signup(signUpDto: SignUpDto) {
    return 'This action adds a new auth : ' + signUpDto.email;
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
