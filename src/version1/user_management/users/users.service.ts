import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './users.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
      withDeleted: false,
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    let hashedPassword: string | undefined;
    if (createUserDto.password) {
      hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    }

    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);
    return new UserResponseDto(savedUser);
  }

  async findAll(): Promise<{
    users: UserResponseDto[];
    total: number;
    totalPages: number;
  }> {
    const [users, total] = await this.userRepository.findAndCount({
      order: { created_at: 'DESC' },
      withDeleted: false,
    });

    return {
      users: users.map((user) => new UserResponseDto(user)),
      total,
      totalPages: total,
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { user_id: id },
      withDeleted: false,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return new UserResponseDto(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      withDeleted: false,
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { user_id: id },
      withDeleted: false,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
        withDeleted: false,
      });

      if (existingUser && existingUser.user_id !== id) {
        throw new ConflictException('User with this email already exists');
      }
    }

    let hashedPassword: string | undefined;
    if (updateUserDto.password) {
      hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
    }

    await this.userRepository.update(id, {
      ...updateUserDto,
      ...(hashedPassword && { password: hashedPassword }),
    });

    const updatedUser = await this.userRepository.findOne({
      where: { user_id: id },
      withDeleted: false,
    });

    if (!updatedUser) {
      throw new NotFoundException('User Not Found');
    }

    return new UserResponseDto(updatedUser);
  }

  async remove(id: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { user_id: id },
      withDeleted: false,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.softDelete(id);
  }

  async restore(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { user_id: id },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!user.deleted_at) {
      throw new BadRequestException('User is not deleted');
    }

    await this.userRepository.restore(id);

    const restoredUser = await this.userRepository.findOne({
      where: { user_id: id },
      withDeleted: false,
    });

    if (!restoredUser) {
      throw new NotFoundException('User was restored but could not be found');
    }

    return new UserResponseDto(restoredUser);
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
    async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    // Hash the refresh token before storing it
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, {
      refresh_token: hashedRefreshToken,
    });
  }
}
