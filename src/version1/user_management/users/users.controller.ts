import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  ValidationPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './users.dto';

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(ValidationPipe) createUserDto: CreateUserDto): Promise<{
    success: boolean;
    message: string;
    data: UserResponseDto;
  }> {
    const user = await this.usersService.create(createUserDto);
    return {
      success: true,
      message: 'User created successfully',
      data: user,
    };
  }

  @Get()
  async findAll(): Promise<{
    success: boolean;
    message: string;
    data: {
      users: UserResponseDto[];
    };
  }> {

    const result = await this.usersService.findAll();

    return {
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users: result.users
      },
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<{
    success: boolean;
    message: string;
    data: UserResponseDto;
  }> {
    const user = await this.usersService.findOne(id);
    return {
      success: true,
      message: 'User retrieved successfully',
      data: user,
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: UserResponseDto;
  }> {
    const user = await this.usersService.update(id, updateUserDto);
    return {
      success: true,
      message: 'User updated successfully',
      data: user,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.usersService.remove(id);
  }

  @Post(':id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string): Promise<{
    success: boolean;
    message: string;
    data: UserResponseDto;
  }> {
    const user = await this.usersService.restore(id);
    return {
      success: true,
      message: 'User restored successfully',
      data: user,
    };
  }
}
