import { Module } from '@nestjs/common';
import { ProfilePhotoController } from './profile-photo.controller';
import { ProfileService } from './profile.service';

@Module({
  controllers: [ProfilePhotoController],
  providers: [ProfileService],
})
export class ProfileModule {}
