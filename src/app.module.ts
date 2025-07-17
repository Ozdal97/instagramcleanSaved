import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InstagramService } from './instagram/instagram.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, InstagramService],
})
export class AppModule {}
