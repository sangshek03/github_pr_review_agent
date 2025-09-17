import { Module } from '@nestjs/common';
import { PrFetchModule } from './pr-fetch/pr-fetch.module';

@Module({
  imports: [PrFetchModule],
})
export class PrManagementModule {}