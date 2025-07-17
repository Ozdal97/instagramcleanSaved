import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { InstagramService } from './instagram/instagram.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly instagramService: InstagramService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('clean')
  async cleanSaved() {
    await this.instagramService.loginAndDeleteSaved('Kulanıcı Adı', 'Şifre');
    return { status: 'ok' };
  }
}
