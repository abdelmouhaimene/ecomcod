import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../../users/users.module.js';
import { SessionService } from './session.service.js';
import { SessionGuard } from './session.guard.js';

@Module({
  imports: [forwardRef(() => UsersModule)],
  providers: [SessionService, SessionGuard],
  exports: [SessionService, SessionGuard],
})
export class SessionModule { }